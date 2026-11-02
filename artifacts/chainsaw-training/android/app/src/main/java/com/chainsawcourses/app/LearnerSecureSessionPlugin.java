package com.chainsawcourses.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * App-owned encrypted mirror for the browser's canonical learner session.
 *
 * Every keystore, cipher, and preferences operation runs on a worker. The
 * browser session remains authoritative, so a bridge failure is non-fatal.
 */
@CapacitorPlugin(name = "LearnerSecureSession")
public class LearnerSecureSessionPlugin extends Plugin {
    private static final String KEY_ALIAS = "chainsawcourses.learner.session";
    private static final String LEGACY_KEY_ALIAS = "capacitor-storage_learnerSession";
    private static final String PREFS_NAME = "learner_secure_session";
    private static final String LEGACY_PREFS_NAME = "WSSecureStorageSharedPreferences";
    private static final String LEGACY_SESSION_KEY = "capacitor-storage_learnerSession";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private final ExecutorService cryptoExecutor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        JSObject value = call.getObject("value");
        if (key == null || key.isEmpty() || value == null) {
            call.reject("A session key and value are required");
            return;
        }
        cryptoExecutor.execute(() -> {
            try {
                byte[] plaintext = value.toString().getBytes(StandardCharsets.UTF_8);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
                byte[] ciphertext = cipher.doFinal(plaintext);
                byte[] encoded = new byte[cipher.getIV().length + ciphertext.length];
                System.arraycopy(cipher.getIV(), 0, encoded, 0, cipher.getIV().length);
                System.arraycopy(ciphertext, 0, encoded, cipher.getIV().length, ciphertext.length);
                if (!preferences().edit()
                    .putString(key, Base64.encodeToString(encoded, Base64.NO_WRAP))
                    .commit()) {
                    throw new IllegalStateException("Could not commit learner session");
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not encrypt learner session", error);
            }
        });
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A session key is required");
            return;
        }
        cryptoExecutor.execute(() -> {
            try {
                String encoded = preferences().getString(key, null);
                JSObject result = new JSObject();
                if (encoded == null) {
                    result.put("value", JSONObject.NULL);
                } else {
                    byte[] encrypted = Base64.decode(encoded, Base64.DEFAULT);
                    if (encrypted.length <= 12) {
                        throw new IllegalStateException("Stored learner session is invalid");
                    }
                    byte[] iv = new byte[12];
                    byte[] ciphertext = new byte[encrypted.length - iv.length];
                    System.arraycopy(encrypted, 0, iv, 0, iv.length);
                    System.arraycopy(encrypted, iv.length, ciphertext, 0, ciphertext.length);
                    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(
                        Cipher.DECRYPT_MODE,
                        getOrCreateKey(),
                        new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
                    );
                    JSONObject value = new JSONObject(
                        new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
                    );
                    result.put("value", value);
                }
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not decrypt learner session", error);
            }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A session key is required");
            return;
        }
        cryptoExecutor.execute(() -> {
            if (!preferences().edit().remove(key).commit()) {
                call.reject("Could not remove learner session");
                return;
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void removeLegacy(PluginCall call) {
        cryptoExecutor.execute(() -> {
            try {
                SharedPreferences oldPreferences = getContext().getSharedPreferences(
                    LEGACY_PREFS_NAME,
                    Context.MODE_PRIVATE
                );
                if (!oldPreferences.edit().remove(LEGACY_SESSION_KEY).commit()) {
                    throw new IllegalStateException("Could not remove legacy learner session");
                }
                KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
                keyStore.load(null);
                if (keyStore.containsAlias(LEGACY_KEY_ALIAS)) {
                    keyStore.deleteEntry(LEGACY_KEY_ALIAS);
                }
                if (oldPreferences.contains(LEGACY_SESSION_KEY)
                    || keyStore.containsAlias(LEGACY_KEY_ALIAS)) {
                    throw new IllegalStateException("Legacy learner session removal could not be verified");
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not remove legacy learner session", error);
            }
        });
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE
        );
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }

    @Override
    protected void handleOnDestroy() {
        cryptoExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}