"""Format oracle: parse a .ots with the OpenTimestamps reference implementation."""
import sys
from opentimestamps.core.timestamp import DetachedTimestampFile
from opentimestamps.core.serialize import BytesDeserializationContext
from opentimestamps.core.notary import PendingAttestation, BitcoinBlockHeaderAttestation, UnknownAttestation

def walk(ts, indent=1):
    for att in ts.attestations:
        pad = "  " * indent
        if isinstance(att, PendingAttestation):
            print(f"{pad}PENDING  -> {att.uri}")
        elif isinstance(att, BitcoinBlockHeaderAttestation):
            print(f"{pad}BITCOIN  -> block {att.height}")
        elif isinstance(att, UnknownAttestation):
            print(f"{pad}UNKNOWN  -> tag {att.TAG.hex()}")
    for op, sub in ts.ops.items():
        print("  " * indent + f"{op}")
        walk(sub, indent + 1)

with open(sys.argv[1], "rb") as f:
    ctx = BytesDeserializationContext(f.read())
    dtf = DetachedTimestampFile.deserialize(ctx)

print(f"PARSE OK")
print(f"  file hash op : {dtf.file_hash_op}")
print(f"  file digest  : {dtf.timestamp.msg.hex()}")
print(f"  tree:")
walk(dtf.timestamp)
