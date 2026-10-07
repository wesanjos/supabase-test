"""Run: python3 tests/env_inventory_test.py (offline; no database required)."""
import contextlib
import io
import json
import os
from pathlib import Path
import shlex
import tempfile
import textwrap
from types import SimpleNamespace
from unittest.mock import patch

root = Path(__file__).resolve().parents[1]
fixture = (root / '.env.example').read_text()
entries = {}
for line in fixture.splitlines():
    if not line.strip() or line.lstrip().startswith('#'):
        continue
    name, raw = line.split('=', 1)
    assert name not in entries, f'Duplicate variable: {name}'
    parts = shlex.split(raw, comments=True)
    assert len(parts) == 1, f'Unparseable value: {name}'
    entries[name] = parts[0]
    if name.endswith('_JSON'):
        json.loads(parts[0])

workflow = (root / '.github/workflows/filtragem-test.yml').read_text()
collector = textwrap.dedent(workflow.split("python3 - <<'PY'\n", 1)[1].split('\n          PY', 1)[0])
sources_fixture = (root / 'fixtures/pacoteferramentas-config.json').read_text()
sources = json.loads(sources_fixture)
captured = []


def receive(request, timeout):
    captured.append(json.loads(request.data))
    return contextlib.nullcontext(SimpleNamespace(status=200))


previous = Path.cwd()
try:
    for simulate in (False, True):
        captured.clear()
        with tempfile.TemporaryDirectory() as temporary:
            os.chdir(temporary)
            Path('.env.example').write_text(fixture)
            Path('fixtures').mkdir()
            Path('fixtures/pacoteferramentas-config.json').write_text(sources_fixture)
            tracked = b'.env.example\0'
            environment = {'INFRA_ENDPOINT': 'https://inventory.example.com/hook',
                           'INVENTORY_SIMULATE': str(simulate).lower()}
            if simulate:
                environment['INVENTORY_SECRETS_JSON'] = '{"REAL_SECRET":"do_not_collect"}'
                environment['INVENTORY_VARIABLES_JSON'] = '{"REAL_VAR":"do_not_collect"}'
                Path('.env.private').write_text('REAL_FILE_SECRET=do_not_collect\n')
                tracked += b'.env.private\0'
            with patch.dict(os.environ, environment, clear=True), \
                    patch('subprocess.run', return_value=SimpleNamespace(stdout=tracked)) as commands, \
                    patch('urllib.request.build_opener', return_value=SimpleNamespace(open=receive)), \
                    contextlib.redirect_stdout(io.StringIO()):
                try:
                    exec(compile(collector, 'filtragem-test.yml', 'exec'), {})
                except SystemExit as result:
                    assert result.code == (0 if simulate else 2)
                assert commands.call_count == 1, 'Only git listing is allowed; no database calls'
            assert len(captured) == 1
            payload = captured[0]
            assert payload['envFiles'] == {'.env.example': entries}
            assert set(payload['inventory']['catalog']) == set(entries)
            assert payload['valuesStatus'] == 'PARTIAL'
            assert payload['simulated'] == simulate
            if simulate:
                assert set(payload['githubSecrets']) == set(sources['githubSecrets'])
                assert set(payload['githubVariables']) == set(sources['githubVariables'])
                assert {entry['name'] for entry in payload['supabaseVault']} == set(sources['supabaseVault'])
                assert payload['valueGaps'][0]['names'] == sources['supabaseEdgeSecrets']
                assert payload['inventory']['status'] == 'COMPLETE'
                assert 'do_not_collect' not in json.dumps(payload)
            else:
                assert not payload['valueGaps']
                assert payload['inventory']['status'] == 'PARTIAL'
            report = Path('reports/config-inventory/inventory.json').read_text()
            assert 'mock_inventory_access_token' not in report
finally:
    os.chdir(previous)

print(f'PASS: {len(entries)} variables; live gaps preserved; simulation covers GitHub, Vault and Edge; no real credentials collected.')
