import os

# Configuration
output_filename = "AI_Career_Path_Project_Full.txt"
# Folders to completely ignore (especially 'uploads' and 'node_modules')
ignore_dirs = {'.git', '__pycache__', 'venv', 'node_modules', '.vscode', 'uploads', 'dist', 'build'}
# File types to include
include_extensions = {'.py', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json'}

def merge_files():
    count = 0
    with open(output_filename, 'w', encoding='utf-8') as outfile:
        # Walk through all directories and subdirectories
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                if any(file.endswith(ext) for ext in include_extensions):
                    file_path = os.path.join(root, file)
                    # Get a clean relative path (e.g., frontend/components/Header.jsx)
                    rel_path = os.path.relpath(file_path, '.')
                    
                    # Write Header
                    outfile.write(f"\n{'='*60}\n")
                    outfile.write(f"PATH: {rel_path}\n")
                    outfile.write(f"{'='*60}\n\n")
                    
                    # Write File Content
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                            outfile.write("\n")
                        count += 1
                    except Exception as e:
                        outfile.write(f"[Error reading file: {e}]\n")

    print(f"Done! Merged {count} files into '{output_filename}'.")

if __name__ == "__main__":
    merge_files()