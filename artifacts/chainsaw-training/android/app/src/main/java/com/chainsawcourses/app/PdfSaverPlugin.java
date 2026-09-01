package com.chainsawcourses.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "PdfSaver")
public class PdfSaverPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Direct Downloads saving requires Android 10 or newer");
            return;
        }

        String filename = sanitiseFilename(call.getString("filename", "Chainsaw-Courses-Document.pdf"));
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("No PDF data was supplied");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS + "/Chainsaw Courses"
        );
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Android could not create the PDF in Downloads");
                return;
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            try (OutputStream output = resolver.openOutputStream(uri, "w")) {
                if (output == null) {
                    throw new IllegalStateException("Android could not open the PDF destination");
                }
                output.write(bytes);
                output.flush();
            }

            ContentValues completed = new ContentValues();
            completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, completed, null, null);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            result.put("folder", "Downloads/Chainsaw Courses");
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) {
                resolver.delete(uri, null, null);
            }
            call.reject("Could not save the PDF to Downloads", error);
        }
    }

    private String sanitiseFilename(String value) {
        String safe = value.replaceAll("[\\\\/:*?\"<>|]+", "-").trim();
        if (safe.isEmpty()) {
            safe = "Chainsaw-Courses-Document.pdf";
        }
        if (!safe.toLowerCase().endsWith(".pdf")) {
            safe += ".pdf";
        }
        return safe;
    }
}