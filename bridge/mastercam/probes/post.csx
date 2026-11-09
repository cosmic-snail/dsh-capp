// post.csx — post all operations with a chosen .pst into an output dir (S-MC spike).
// {{POST_PATH}} = absolute .pst path; {{NC_DIR}} = empty output directory;
// {{RESULT_PATH}} = JSON output. The NC file name comes from the program name.
using System;
using System.IO;
using System.Text;
string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}
string post = @"{{POST_PATH}}";
string ncDir = @"{{NC_DIR}}";
string resultPath = @"{{RESULT_PATH}}";
string error = null;
bool posted = false;
string ncFile = null;
long ncSize = -1;
try {
    if (Mastercam.Operations.OperationsManager.NCPrompt)
        throw new Exception("NCPrompt is true; post would block on UI");
    Mastercam.Operations.OperationsManager.PostName = Path.GetFullPath(post);
    if (!string.Equals(
            Path.GetFullPath(Mastercam.Operations.OperationsManager.PostName),
            Path.GetFullPath(post), StringComparison.OrdinalIgnoreCase))
        throw new Exception("PostName did not take the requested .pst");
    if (Mastercam.Operations.OperationsManager.NCPrompt)
        throw new Exception("NCPrompt became true after PostName");
    if (!Directory.Exists(ncDir)) Directory.CreateDirectory(ncDir);
    Mastercam.Operations.OperationsManager.PostAllOperations(ncDir, false, false, false);
    var files = Directory.GetFiles(ncDir, "*", SearchOption.AllDirectories);
    if (files.Length == 1) {
        ncFile = files[0];
        ncSize = new FileInfo(ncFile).Length;
        posted = ncSize > 0;
        if (!posted) error = "posted file is empty";
    } else {
        error = "expected exactly 1 output file, found " + files.Length;
    }
} catch (Exception ex) {
    error = ex.GetType().Name + ": " + ex.Message;
}
string json = "{\"posted\":" + (posted ? "true" : "false")
    + ",\"ncFile\":" + J(ncFile) + ",\"ncSize\":" + ncSize
    + ",\"post\":" + J(post) + ",\"error\":" + J(error) + "}";
File.WriteAllText(resultPath, json, new UTF8Encoding(false));
