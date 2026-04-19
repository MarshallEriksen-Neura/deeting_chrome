import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        print('Usage: python bump-version.py <new_version>')
        print('Example: python bump-version.py 0.1.1')
        raise SystemExit(1)

    version = sys.argv[1].lstrip('v')
    root = Path(__file__).resolve().parent

    print(f'Bumping deeting_chrome version to {version}...')

    for name in ('package.json', 'manifest.json'):
        path = root / name
        if not path.exists():
            raise SystemExit(f'File not found: {path}')

        data = json.loads(path.read_text(encoding='utf-8'))
        old = data.get('version')
        if old is None:
            raise SystemExit(f'Missing version field in {path}')

        if old == version:
            print(f'Skipped {path} (already {version})')
            continue

        data['version'] = version
        path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
        print(f'Updated {path} ({old} -> {version})')

    print('\nAll version files updated.')
    print('Next steps:')
    print('1. git add package.json manifest.json bump-version.py')
    print('2. git commit -m chore(release): v' + version)
    print('3. git tag v' + version)
    print('4. git push origin main')
    print('5. git push origin v' + version)


if __name__ == '__main__':
    main()
