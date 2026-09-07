import os
import re

frontend_dir = r"c:\Users\jayas\OneDrive\Desktop\c2c tick\frontend"

missing_count = 0
found_count = 0

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            rel_root = os.path.relpath(path, frontend_dir)

            # Check stylesheets
            for href in re.findall(r'<link[^>]+href=[\'"]([^\'"]+)[\'"]', content):
                if not href.startswith('http') and not href.startswith('//'):
                    target = os.path.normpath(os.path.join(root, href))
                    if os.path.exists(target):
                        found_count += 1
                    else:
                        print(f"MISSING LINK: {rel_root} -> {href} (looked in {target})")
                        missing_count += 1

            # Check scripts
            for src in re.findall(r'<script[^>]+src=[\'"]([^\'"]+)[\'"]', content):
                if not src.startswith('http') and not src.startswith('//'):
                    target = os.path.normpath(os.path.join(root, src))
                    if os.path.exists(target):
                        found_count += 1
                    else:
                        print(f"MISSING SCRIPT: {rel_root} -> {src} (looked in {target})")
                        missing_count += 1

            # Check images
            for src in re.findall(r'<img[^>]+src=[\'"]([^\'"]+)[\'"]', content):
                if not src.startswith('http') and not src.startswith('//') and not src.startswith('data:'):
                    target = os.path.normpath(os.path.join(root, src))
                    if os.path.exists(target):
                        found_count += 1
                    else:
                        print(f"MISSING IMG: {rel_root} -> {src} (looked in {target})")
                        missing_count += 1

print(f"Checked assets: {found_count} found, {missing_count} missing.")
