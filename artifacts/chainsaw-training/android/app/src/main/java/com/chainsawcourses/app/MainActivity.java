package com.chainsawcourses.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PdfSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
