package com.chainsawcourses.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final long STARTUP_TIMEOUT_MS = 15_000L;

    private final Handler startupHandler = new Handler(Looper.getMainLooper());
    private boolean initialPageVisible = false;

    private final Runnable startupTimeout = () -> {
        if (initialPageVisible || bridge == null) {
            return;
        }

        String errorUrl = bridge.getErrorUrl();
        if (errorUrl != null) {
            bridge.getWebView().loadUrl(errorUrl);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfSaverPlugin.class);
        registerPlugin(LearnerSecureSessionPlugin.class);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView webView, String url) {
                initialPageVisible = true;
                startupHandler.removeCallbacks(startupTimeout);
            }
        });
        super.onCreate(savedInstanceState);
        startupHandler.postDelayed(startupTimeout, STARTUP_TIMEOUT_MS);
    }

    @Override
    public void onDestroy() {
        startupHandler.removeCallbacks(startupTimeout);
        super.onDestroy();
    }
}
