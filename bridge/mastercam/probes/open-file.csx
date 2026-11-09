// open-file.csx — open a .mcam document through the Mastercam .NET API (S-MC spike).
// {{MCAM_PATH}} = absolute path; {{RESULT_PATH}} = JSON output.
// Uses the real signature: FileManager.Open(bool promptToSave, string path, bool merge, bool asText).
using System;
using System.IO;
using System.Text;
string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}
string target = @"{{MCAM_PATH}}";
string resultPath = @"{{RESULT_PATH}}";
string before = null, after = null, error = null;
bool ok = false;
try { before = Mastercam.IO.FileManager.CurrentFileName; } catch {}
try {
    ok = Mastercam.IO.FileManager.Open(false, target, false, false);
} catch (Exception ex) {
    error = ex.GetType().Name + ": " + ex.Message;
}
try { after = Mastercam.IO.FileManager.CurrentFileName; } catch {}
bool opened = ok
    && !string.IsNullOrEmpty(after)
    && string.Equals(Path.GetFullPath(after), Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase);
string json = "{\"openReturned\":" + (ok ? "true" : "false")
    + ",\"opened\":" + (opened ? "true" : "false")
    + ",\"before\":" + J(before) + ",\"after\":" + J(after)
    + ",\"error\":" + J(error) + "}";
File.WriteAllText(resultPath, json, new UTF8Encoding(false));
