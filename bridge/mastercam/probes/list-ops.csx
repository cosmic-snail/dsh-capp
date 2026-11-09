// list-ops.csx — list every operation's database id, type and key rates (S-MC spike).
using System;
using System.IO;
using System.Text;
int[] ids = Mastercam.Support.SearchManager.GetOperationIDs(true);
var ops = Mastercam.Support.SearchManager.GetOperations();
var sb = new StringBuilder();
sb.Append("{\"idArray\":[");
for (int i = 0; i < ids.Length; i++) { if (i > 0) sb.Append(','); sb.Append(ids[i]); }
sb.Append("],\"ops\":[");
for (int i = 0; i < ops.Length; i++) {
    var op = ops[i];
    if (i > 0) sb.Append(',');
    sb.Append("{\"index\":").Append(i);
    try { sb.Append(",\"opId\":").Append(op.GetOperationID()); } catch (Exception e) { sb.Append(",\"opIdErr\":\"").Append(e.GetType().Name).Append("\""); }
    try { sb.Append(",\"type\":\"").Append(op.Type.ToString()).Append("\""); } catch {}
    try { sb.Append(",\"feed\":").Append(op.FeedRate.ToString("R", System.Globalization.CultureInfo.InvariantCulture)); } catch {}
    try { sb.Append(",\"rpm\":").Append(op.SpindleSpeed); } catch {}
    try { sb.Append(",\"name\":\"").Append((op.Name ?? "").Replace("\"", "'")).Append("\""); } catch {}
    sb.Append('}');
}
sb.Append("]}");
File.WriteAllText(@"{{RESULT_PATH}}", sb.ToString(), new UTF8Encoding(false));
