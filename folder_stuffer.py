import os
import shutil
import json
import re
import argparse
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

# --- Core Logic ---

class FolderStuffer:
    def __init__(self, rules_file='rules.json'):
        self.rules = self.load_rules(rules_file)

    def load_rules(self, filepath) -> list:
        """Loads organization rules from a JSON file."""
        try:
            with open(filepath, 'r') as f:
                return json.load(f).get('rules', [])
        except FileNotFoundError:
            print(f"Error: Rules file not found at '{filepath}'")
            return []
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from '{filepath}'")
            return []

    def _get_template_vars(self, filepath: str) -> dict[str, str]:
        """Extracts variables for template substitution."""
        mtime = os.path.getmtime(filepath)
        date = datetime.fromtimestamp(mtime)
        return {
            "year": date.strftime("%Y"),
            "month": date.strftime("%m"),
            "day": date.strftime("%d"),
            "filename": os.path.basename(filepath)
        }

    def _match_condition(self, filepath: str, condition: dict) -> bool:
        """Checks if a file matches a given condition."""
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()
        size_mb = os.path.getsize(filepath) / (1024 * 1024)

        if 'extension' in condition:
            if isinstance(condition['extension'], list):
                if ext not in condition['extension']:
                    return False
            elif ext != condition['extension']:
                return False

        if 'name_pattern' in condition:
            if not re.search(condition['name_pattern'], filename, re.IGNORECASE):
                return False

        if 'size_mb' in condition:
            size_rule = condition['size_mb']
            if 'greater_than' in size_rule and size_mb <= size_rule['greater_than']:
                return False
            if 'less_than' in size_rule and size_mb >= size_rule['less_than']:
                return False
        
        return True

    def _apply_action(self, source_path, action, base_dest_path, dry_run=False) -> str:
        """Applies the specified action to a file."""
        if action['type'] == 'delete':
            if not dry_run:
                os.remove(source_path)
            return "Deleted"

        if 'destination' in action:
            template_vars = self._get_template_vars(source_path)
            
            # Handle regex group variables from name_pattern
            if 'name_pattern' in self.current_rule.get('condition', {}):
                match = re.search(self.current_rule['condition']['name_pattern'], os.path.basename(source_path), re.IGNORECASE)
                if match:
                    for i, group in enumerate(match.groups()):
                        template_vars[f'group{i+1}'] = group

            dest_path: str = os.path.join(base_dest_path, action['destination'].format(**template_vars))
            
            if not dry_run:
                os.makedirs(dest_path, exist_ok=True)
                shutil.move(source_path, dest_path)
            
            return f"Moved to {dest_path}"
        
        return "No action taken"

    def organize(self, source_dir: str, dest_dir: str, dry_run: bool = False) -> None:
        """Organizes files from source to destination based on rules."""
        if not os.path.isdir(source_dir):
            print(f"Error: Source directory '{source_dir}' not found.")
            return

        processed_files = 0
        print(f"--- Starting organization {'(DRY RUN)' if dry_run else ''} ---")
        print(f"Source: {source_dir}")
        print(f"Destination: {dest_dir}\n")

        for filename in os.listdir(source_dir):
            source_path = os.path.join(source_dir, filename)
            if not os.path.isfile(source_path):
                continue

            moved = False
            for rule in self.rules:
                self.current_rule = rule # Store for use in _apply_action
                if self._match_condition(source_path, rule['condition']):
                    result = self._apply_action(source_path, rule['action'], dest_dir, dry_run)
                    print(f"[{rule['name']}] '{filename}' -> {result}")
                    moved = True
                    break # Apply first matching rule only
            
            if not moved:
                print(f"[No Match] '{filename}' -> Skipped")
            
            processed_files += 1

        print(f"\n--- Finished. Processed {processed_files} files. ---")


# --- User Interfaces ---

def run_cli():
    """Sets up and runs the command-line interface."""
    parser = argparse.ArgumentParser(description="Folder Stucker: Automatic File Organizer.")
    parser.add_argument("source", help="The source folder to organize.")
    parser.add_argument("destination", nargs='?', default=None, help="The destination folder (defaults to source).")
    parser.add_argument("--rules", default="rules.json", help="Path to the custom rules JSON file.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without moving files.")
    parser.add_argument("--gui", action="store_true", help="Launch the graphical user interface.")
    
    args = parser.parse_args()

    if args.gui:
        run_gui(args.source, args.destination, args.rules)
    else:
        dest_dir = args.destination if args.destination else args.source
        stuffer = FolderStuffer(args.rules)
        stuffer.organize(args.source, dest_dir, args.dry_run)


class FolderStufferGUI:
    def __init__(self, master, initial_source="", initial_dest="", rules_file="rules.json"):
        self.master = master
        master.title("Folder Stucker")
        self.stuffer = FolderStuffer(rules_file)

        # --- Variables ---
        self.source_path = tk.StringVar(value=initial_source)
        self.dest_path = tk.StringVar(value=initial_dest)
        self.is_running = False

        # --- Widgets ---
        self.create_widgets()

    def create_widgets(self):
        main_frame = ttk.Frame(self.master, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Source Folder
        ttk.Label(main_frame, text="Source Folder:").grid(row=0, column=0, sticky=tk.W, pady=2)
        ttk.Entry(main_frame, textvariable=self.source_path, width=50).grid(row=0, column=1, sticky=(tk.W, tk.E), padx=5)
        ttk.Button(main_frame, text="Browse...", command=self.browse_source).grid(row=0, column=2)

        # Destination Folder
        ttk.Label(main_frame, text="Destination Folder:").grid(row=1, column=0, sticky=tk.W, pady=2)
        ttk.Entry(main_frame, textvariable=self.dest_path, width=50).grid(row=1, column=1, sticky=(tk.W, tk.E), padx=5)
        ttk.Button(main_frame, text="Browse...", command=self.browse_dest).grid(row=1, column=2)
        
        # Action Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=3, pady=10)
        
        self.dry_run_button = ttk.Button(button_frame, text="Dry Run", command=self.dry_run)
        self.dry_run_button.pack(side=tk.LEFT, padx=5)
        
        self.organize_button = ttk.Button(button_frame, text="Organize", command=self.organize)
        self.organize_button.pack(side=tk.LEFT, padx=5)

        # Status/Log Area
        ttk.Label(main_frame, text="Log:").grid(row=3, column=0, sticky=tk.W)
        self.log_area = scrolledtext.ScrolledText(main_frame, width=70, height=15, state=tk.DISABLED)
        self.log_area.grid(row=4, column=0, columnspan=3, pady=5, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Progress Bar
        self.progress = ttk.Progressbar(main_frame, orient=tk.HORIZONTAL, length=100, mode='indeterminate')
        self.progress.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)

        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(4, weight=1)

    def log(self, message):
        self.log_area.config(state=tk.NORMAL)
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)
        self.log_area.config(state=tk.DISABLED)
        self.master.update_idletasks()

    def browse_source(self):
        path = filedialog.askdirectory()
        if path:
            self.source_path.set(path)
            if not self.dest_path.get():
                self.dest_path.set(path)

    def browse_dest(self):
        path = filedialog.askdirectory()
        if path:
            self.dest_path.set(path)

    def run_organization_task(self, dry_run=False):
        if self.is_running:
            return
        
        source = self.source_path.get()
        dest = self.dest_path.get()
        
        if not source or not dest:
            messagebox.showerror("Error", "Please select both source and destination folders.")
            return

        self.is_running = True
        self.dry_run_button.config(state=tk.DISABLED)
        self.organize_button.config(state=tk.DISABLED)
        self.log_area.config(state=tk.NORMAL)
        self.log_area.delete(1.0, tk.END)
        self.log_area.config(state=tk.DISABLED)
        self.progress.start()
        
        # Run the heavy lifting in a separate thread to avoid freezing the GUI
        self.master.after(100, lambda: self._run_in_thread(source, dest, dry_run))

    def _run_in_thread(self, source, dest, dry_run):
        try:
            # Redirect print statements to our log area
            import sys
            from contextlib import redirect_stdout
            
            class TextRedirector:
                def __init__(self, widget):
                    self.widget = widget
                def write(self, text: str) -> int:
                    self.widget.config(state=tk.NORMAL)
                    self.widget.insert(tk.END, text)
                    self.widget.see(tk.END)
                    self.widget.config(state=tk.DISABLED)
                    return len(text)
                def flush(self) -> None: pass

            redirector = TextRedirector(self.log_area)
            
            with redirect_stdout(redirector):
                self.stuffer.organize(str(source), str(dest), dry_run)
            
            messagebox.showinfo("Success", "Organization complete!")

        except Exception as e:
            messagebox.showerror("Error", f"An error occurred: {e}")
        finally:
            self.progress.stop()
            self.is_running = False
            self.dry_run_button.config(state=tk.NORMAL)
            self.organize_button.config(state=tk.NORMAL)

    def dry_run(self):
        self.run_organization_task(dry_run=True)

    def organize(self):
        if messagebox.askyesno("Confirm", "This will move files. Are you sure?"):
            self.run_organization_task(dry_run=False)


def run_gui(initial_source: str, initial_dest: str, rules_file: str):
    root = tk.Tk()
    FolderStufferGUI(root, initial_source, initial_dest, rules_file)
    root.mainloop()


if __name__ == "__main__":
    run_cli()