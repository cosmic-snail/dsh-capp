// count-ops.csx — report the open document and its operation ids (S-MC spike).
string J(string s) {
    return s == null ? "null" : "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
        .Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
}
int[] ids = Mastercam.Support.SearchManager.GetOperationIDs(true);
var sb = new System.Text.StringBuilder();
sb.Append("{\"file\":").Append(J(Mastercam.IO.FileManager.CurrentFileName))
  .Append(",\"ops\":").Append(ids.Length)
  .Append(",\"ids\":[");
for (int i = 0; i < ids.Length; i++) {
    if (i > 0) sb.Append(',');
    sb.Append(ids[i]);
}
sb.Append("]}");
System.IO.File.WriteAllText(@"{{RESULT_PATH}}", sb.ToString(), new System.Text.UTF8Encoding(false));
