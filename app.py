from flask import Flask, jsonify, request, send_from_directory, send_file
from pathlib import Path
import json
import os
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Initialize variables
STATI_DIR = Path("stati")
MARKINGS_FILE = "state_markings.json"

def load_markings():
    try:
        with open(MARKINGS_FILE, 'r') as f:
            data = json.load(f)
            if 'notes' not in data:  # Add notes field if not present
                data['notes'] = {}
            return data
    except FileNotFoundError:
        return {'markings': {}, 'highlights': {}, 'notes': {}}

def save_markings(data):
    with open(MARKINGS_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def parse_state_file(content, state_notes=None):
    """Parse state file content into structured sections."""
    sections = {
        'STATO': '',
        'REQUISITI DELLE COPPIE ADOTTANTI': '',
        'REQUISITI DEI MINORI ADOTTANDI': '',
        'PASSAGGI DELLA PROCEDURA': '',
        'EFFETTI DELL\'ADOZIONE': '',
        'POST ADOZIONE': '',
        'NOTE': ''
    }
    
    # Split content into lines and clean them
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    # Find all section positions
    current_section = None
    current_content = []
    
    for i, line in enumerate(lines):
        # Check if this line is a main section header
        found_section = None
        for section in sections.keys():
            if line == section + ':':  # Exact match for section header
                found_section = section
                break
        
        if found_section:
            # Save content of previous section if exists
            if current_section and current_content:
                sections[current_section] = '\n'.join(current_content).strip()
            current_section = found_section
            current_content = []
        elif current_section:
            # Add line to current section
            current_content.append(line)
    
    # Add the last section's content
    if current_section and current_content:
        sections[current_section] = '\n'.join(current_content).strip()
    
    # Clean up empty sections
    sections = {k: v for k, v in sections.items() if v}
    
    # If we have notes from state_markings.json, use those instead of file content
    if state_notes:
        if state_notes.strip():
            sections['NOTE'] = state_notes
        elif 'NOTE' in sections:
            del sections['NOTE']
    
    # Move legal provisions and procedural details from NOTE to appropriate sections
    if 'NOTE' in sections:
        note_content = sections['NOTE']
        
        # Look for legal provisions (articles, codes)
        legal_pattern = r'(?:art\.|articolo|comma)\s*\d+'
        if re.search(legal_pattern, note_content, re.IGNORECASE):
            if 'EFFETTI DELL\'ADOZIONE' not in sections:
                sections['EFFETTI DELL\'ADOZIONE'] = ''
            
            # Move content containing legal references to EFFETTI DELL'ADOZIONE
            legal_lines = [line.strip() for line in note_content.split('\n') 
                         if re.search(legal_pattern, line, re.IGNORECASE)]
            
            if legal_lines:
                sections['EFFETTI DELL\'ADOZIONE'] += '\n'.join(legal_lines)
                
                # Remove moved lines from NOTE
                remaining_lines = [line.strip() for line in note_content.split('\n') 
                                if line.strip() and line.strip() not in legal_lines]
                sections['NOTE'] = '\n'.join(remaining_lines)
        
        # If NOTE section is empty after moving content, remove it
        if not sections['NOTE'].strip():
            del sections['NOTE']
            
    return sections

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/states')
def get_states():
    states = [f.stem for f in STATI_DIR.glob("*.txt")]
    states.sort()
    return jsonify(states)

@app.route('/api/state/<state>')
def get_state(state):
    try:
        file_path = STATI_DIR / f"{state}.txt"
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Get notes from state_markings.json
        markings_data = load_markings()
        state_notes = markings_data.get('notes', {}).get(state, '')
            
        # Parse the content into sections, using notes from state_markings.json
        parsed_content = parse_state_file(content, state_notes)
        
        return jsonify({'content': content})
    except FileNotFoundError:
        return jsonify({'error': 'State not found'}), 404

@app.route('/api/state/<state>/structured')
def get_structured_state(state):
    try:
        file_path = STATI_DIR / f"{state}.txt"
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Get notes from state_markings.json
        markings_data = load_markings()
        state_notes = markings_data.get('notes', {}).get(state, '')
            
        # Parse the content into sections, using notes from state_markings.json
        parsed_content = parse_state_file(content, state_notes)
                
        return jsonify({
            'raw_content': content,
            'parsed_content': parsed_content
        })
    except FileNotFoundError:
        return jsonify({'error': 'State not found'}), 404

@app.route('/api/markings')
def get_markings():
    return jsonify(load_markings())

@app.route('/api/mark_state', methods=['POST'])
def mark_state():
    data = request.json
    state = data.get('state')
    marking = data.get('marking')
    
    if not state or not marking:
        return jsonify({'error': 'Missing state or marking'}), 400
    
    markings_data = load_markings()
    markings_data['markings'][state] = marking
    save_markings(markings_data)
    return jsonify({'success': True})

@app.route('/api/highlight', methods=['POST'])
def add_highlight():
    try:
        data = request.get_json()
        print('Received highlight request:', data)
        
        if not data:
            print('No JSON data received')
            return jsonify({'error': 'No JSON data received'}), 400
        
        state = data.get('state')
        highlight_data = data.get('highlight')
        
        if not state or not highlight_data:
            print(f'Missing data - state: {state}, highlight: {highlight_data}')
            return jsonify({'error': 'Missing state or highlight data'}), 400
        
        # Validate highlight data
        required_fields = ['section', 'start', 'end', 'color', 'text']
        missing_fields = [field for field in required_fields if field not in highlight_data]
        if missing_fields:
            print(f'Missing highlight fields: {missing_fields}')
            return jsonify({'error': f'Missing highlight fields: {missing_fields}'}), 400
        
        markings_data = load_markings()
        print('Current markings:', markings_data)
        
        if state not in markings_data['highlights']:
            markings_data['highlights'][state] = []
        
        # Remove any existing highlights for this selection
        markings_data['highlights'][state] = [
            h for h in markings_data['highlights'][state]
            if not (h['section'] == highlight_data['section'] and
                    h['start'] == highlight_data['start'] and
                    h['end'] == highlight_data['end'])
        ]
        
        # Add new highlight
        markings_data['highlights'][state].append(highlight_data)
        
        # Save to file
        save_markings(markings_data)
        print('Updated markings:', markings_data)
        
        return jsonify({
            'success': True,
            'highlights': markings_data['highlights'][state],
            'message': 'Highlight saved successfully'
        })
        
    except Exception as e:
        import traceback
        print('Error in add_highlight:', str(e))
        print('Traceback:', traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/remove_highlight', methods=['POST'])
def remove_highlight():
    try:
        data = request.get_json()
        state = data.get('state')
        section = data.get('section')
        start = data.get('start')
        end = data.get('end')

        if not all([state, section, start is not None, end is not None]):
            return jsonify({'error': 'Missing required fields'}), 400

        # Load current markings
        with open('state_markings.json', 'r', encoding='utf-8') as f:
            markings = json.load(f)

        # Find and remove the highlight
        if state in markings['highlights']:
            highlights = markings['highlights'][state]
            # Find highlight by matching section, start, and end positions
            for i, highlight in enumerate(highlights):
                if (highlight['section'] == section and 
                    highlight['start'] == start and 
                    highlight['end'] == end):
                    del highlights[i]
                    break

            # Remove empty highlight lists
            if not highlights:
                del markings['highlights'][state]
            else:
                markings['highlights'][state] = highlights

            # Save updated markings
            with open('state_markings.json', 'w', encoding='utf-8') as f:
                json.dump(markings, f, indent=4, ensure_ascii=False)

        return jsonify({'status': 'success'})

    except Exception as e:
        print('Error in remove_highlight:', str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/save_notes', methods=['POST'])
def save_notes():
    data = request.json
    state = data.get('state')
    notes = data.get('notes')
    
    if not state:
        return jsonify({'error': 'Missing state'}), 400
    
    try:
        markings = load_markings()
        markings['notes'][state] = notes.strip() if notes else ""
        save_markings(markings)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_markings')
def download_markings():
    try:
        return send_file(
            MARKINGS_FILE,
            mimetype='application/json',
            as_attachment=True,
            download_name='state_markings.json'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload_markings', methods=['POST'])
def upload_markings():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.json'):
        try:
            content = json.loads(file.read())
            # Validate the structure
            required_keys = {'markings', 'highlights'}
            if not all(key in content for key in required_keys):
                return jsonify({'error': 'Invalid file structure'}), 400
            
            # Add notes field if not present
            if 'notes' not in content:
                content['notes'] = {}
            
            # Save the uploaded file
            save_markings(content)
            return jsonify({'success': True})
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid JSON file'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/search_content', methods=['GET'])
def search_content():
    try:
        query = request.args.get('query', '').strip()
        if not query:
            return jsonify({'states': [], 'content': {}})

        # Escape special regex characters but keep spaces
        escaped_query = ''.join('\\' + c if c in '.^$*+?{}[]\\|()' else c for c in query)
        # Convert spaces to match any whitespace
        search_pattern = '\\s+'.join(escaped_query.split())
        
        matching_states = []
        state_contents = {}

        for file_path in STATI_DIR.glob("*.txt"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Use regex to find the exact sequence of words
                    if re.search(search_pattern, content, re.IGNORECASE):
                        state_name = file_path.stem
                        matching_states.append(state_name)
                        state_contents[state_name] = content

            except Exception as e:
                print(f"Error reading file {file_path}: {str(e)}")

        matching_states.sort()
        return jsonify({
            'states': matching_states,
            'content': state_contents
        })

    except Exception as e:
        print('Error in search_content:', str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/search_state_content/<state>')
def search_state_content(state):
    query = request.args.get('query', '').lower()
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        file_path = STATI_DIR / f"{state}.txt"
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Split content into sections
        sections = {
            'REQUISITI DELLE COPPIE ADOTTANTI': '',
            'REQUISITI DEI MINORI ADOTTANDI': '',
            'PASSAGGI DELLA PROCEDURA': '',
            'POST ADOZIONE': '',
            'NOTE': ''
        }
        
        current_section = None
        current_content = []
        
        for line in content.split('\n'):
            if line.strip() in sections:
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                current_section = line.strip()
                current_content = []
            elif current_section:
                current_content.append(line)
        
        if current_section:
            sections[current_section] = '\n'.join(current_content)

        # Search in each section
        matches = {}
        for section, text in sections.items():
            if text and query.lower() in text.lower():
                matches[section] = text

        return jsonify({'matches': matches})
    except FileNotFoundError:
        return jsonify({'error': 'State not found'}), 404

@app.route('/ping')
def ping():
    """Endpoint to keep the server alive"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Use environment variables for configuration
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
