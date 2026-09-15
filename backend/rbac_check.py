import re
import sys

routes = open('src/Routes.gs', encoding='utf-8').read()
setup = open('src/Setup.gs', encoding='utf-8').read()

used = set(re.findall(r"permission:\s*'([A-Za-z_.]+)'", routes))
seeded = set(re.findall(r"\[\s*'([A-Za-z_]+\.[A-Za-z_]+)'", setup))

print('routes gated on:', len(used), 'permissions')
print('seeded in Permissions sheet:', len(seeded))
missing = sorted(used - seeded)
print('UNSEEDED (would FORBID everyone):', missing)
# 1 means unseeded keys found
sys.exit(1 if missing else 0)
