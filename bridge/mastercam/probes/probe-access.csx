// probe-access.csx — try every operation accessor and report which resolve (S-MC spike).
using System;
using System.IO;
using System.Text;
var sb = new StringBuilder();
sb.Append("{\"results\":{");
void Try(string name, Func<object> f) {
    if (sb.Length > 12 && sb[sb.Length - 1] != '{') sb.Append(',');
    try {
        var v = f();
        if (v == null) { sb.Append(J2(name)).Append(":null"); return; }
        if (v is Array a) { sb.Append(J2(name)).Append(":{\"count\":").Append(a.Length).Append('}'); return; }
        var op = v as Mastercam.Database.Operation;
        if (op != null) {
            string id = "?", ty = "?";
            try { id = op.GetOperationID().ToString(); } catch {}
            try { ty = op.Type.ToString(); } catch {}
            sb.Append(J2(name)).Append(":{\"id\":").Append(id).Append(",\"type\":").Append(J2(ty)).Append('}');
            return;
        }
        sb.Append(J2(name)).Append(":{\"type\":\"").Append(v.GetType().Name).Append("\"}");
    } catch (Exception e) {
        sb.Append(J2(name)).Append(":{\"err\":\"").Append(e.GetType().Name).Append("\"}");
    }
}
string J2(string s) { return "\"" + s.Replace("\"", "'") + "\""; }
Try("GetOperation_2", () => Mastercam.Support.SearchManager.GetOperation(2));
Try("GetOperation_1", () => Mastercam.Support.SearchManager.GetOperation(1));
Try("Caster_2", () => Mastercam.Support.Typecaster.OperationCaster(2));
Try("GetOps_all", () => Mastercam.Support.SearchManager.GetOperations());
Try("GetOps_selFalse", () => Mastercam.Support.SearchManager.GetOperations(false));
Try("GetOps_group2", () => Mastercam.Support.SearchManager.GetOperations(2));
Try("GetOps_group1", () => Mastercam.Support.SearchManager.GetOperations(1));
foreach (Mastercam.Database.Types.OperationType t in Enum.GetValues(typeof(Mastercam.Database.Types.OperationType))) {
    string tn = t.ToString();
    if (tn.IndexOf("Lathe", StringComparison.Ordinal) >= 0 || tn.IndexOf("Turn", StringComparison.Ordinal) >= 0)
        Try("GetOps_" + tn, () => Mastercam.Support.SearchManager.GetOperations(t));
}
sb.Append("}}");
File.WriteAllText(@"{{RESULT_PATH}}", sb.ToString(), new UTF8Encoding(false));
