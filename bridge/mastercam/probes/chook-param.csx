// chook-param.csx — run the param-probe CHook once through Mastercam.dll's RunCHook (S-MC task 6).
// {{DLL}} = absolute path to CappParamProbe.dll; {{REQUEST}} = absolute path to the request file
// (format in chook/probe_request.hpp); {{RECEIPT}} = JSON output for this script.
// The CHook writes its own result.json (path inside the request). This receipt records only
// whether the DLL loaded, its return code and the threads involved.
// Uses only System APIs, so it can be type-checked off Windows (chook/README.md).
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}

string dll = @"{{DLL}}";
string request = @"{{REQUEST}}";
string receiptPath = @"{{RECEIPT}}";
string error = null;
bool loaded = false;
int code = -999;

// The CHook reads this with GetEnvironmentVariableW; same process, so no CRT copy issue.
Environment.SetEnvironmentVariable("CAPP_CHOOK_REQUEST", request);

uint scriptThread = ProbeNative.GetCurrentThreadId();
var process = Process.GetCurrentProcess();
uint ownerPid;
uint uiThread = ProbeNative.GetWindowThreadProcessId(process.MainWindowHandle, out ownerPid);

try {
    if (!File.Exists(dll)) throw new FileNotFoundException("CHook DLL not found", dll);
    if (!File.Exists(request)) throw new FileNotFoundException("request file not found", request);
    loaded = ProbeNative.RunCHook(dll, false, ref code);
} catch (Exception ex) {
    error = ex.GetType().Name + ": " + ex.Message;
}
Environment.SetEnvironmentVariable("CAPP_CHOOK_REQUEST", null);

string receipt = "{\"loaded\":" + (loaded ? "true" : "false")
    + ",\"return_code\":" + code
    + ",\"script_thread\":" + scriptThread
    + ",\"ui_thread\":" + uiThread
    + ",\"on_ui_thread\":" + (scriptThread == uiThread ? "true" : "false")
    + ",\"error\":" + J(error) + "}";
File.WriteAllText(receiptPath, receipt, new UTF8Encoding(false));

public static class ProbeNative {
    // Mastercam 2026 export, decorated C++ name: bool RunCHook(const wchar_t*, bool, int*).
    // "Mastercam.dll" resolves to the module already loaded in this process.
    [DllImport("Mastercam.dll", EntryPoint = "?RunCHook@@YA_NPEB_W_NPEAH@Z",
        CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.I1)]
    public static extern bool RunCHook(string path, [MarshalAs(UnmanagedType.I1)] bool report, ref int result);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
}
