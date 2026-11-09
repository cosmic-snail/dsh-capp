# journal.py.tpl — NX batch journal for capp-step (S-NX spike).
# {{NAME}} placeholders become absolute paths at render time.
# Imports STEP via the STEP214 importer, runs the extractor on the work
# part, and writes nx-report.json into OUT_DIR.
import os
import json
import importlib.util

import NXOpen

WORK_DIR = r"{{WORK_DIR}}"
STEP_FILE = r"{{STEP_FILE}}"
SETTINGS_FILE = r"{{SETTINGS_FILE}}"
EXTRACTOR = r"{{EXTRACTOR}}"
OUT_DIR = r"{{OUT_DIR}}"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


session = NXOpen.Session.GetSession()
part = session.Parts.NewDisplay(
    os.path.join(WORK_DIR, "import.prt"), NXOpen.Part.Units.Millimeters
)

importer = session.DexManager.CreateStep214Importer()
importer.InputFile = STEP_FILE
importer.OutputFile = os.path.join(WORK_DIR, "converted.prt")
importer.SettingsFile = SETTINGS_FILE
importer.FileOpenFlag = False
importer.ProcessHoldFlag = True
importer.ObjectTypes.Solids = True
importer.Commit()
importer.Destroy()

save = part.Save(
    NXOpen.BasePart.SaveComponents.TrueValue, NXOpen.BasePart.CloseAfterSave.FalseValue
)
save.Dispose()

extractor = load_module("capp_nx_extractor", EXTRACTOR)
extractor.OUTPUT_DIRECTORY = os.path.join(WORK_DIR, "extraction")
os.makedirs(extractor.OUTPUT_DIRECTORY, exist_ok=True)
extractor.main_v7()

reports = [
    os.path.join(extractor.OUTPUT_DIRECTORY, name)
    for name in os.listdir(extractor.OUTPUT_DIRECTORY)
    if name.endswith(".json")
]
if len(reports) != 1:
    raise RuntimeError("expected one extractor report, found %d" % len(reports))
with open(reports[0], encoding="utf-8") as src:
    report = json.load(src)
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, "nx-report.json"), "w", encoding="utf-8") as dst:
    json.dump(report, dst, ensure_ascii=False)
