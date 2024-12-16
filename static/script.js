let currentState = null;
const sections = {
    'REQUISITI DELLE COPPIE ADOTTANTI': 'requisiti-coppie',
    'REQUISITI DEI MINORI ADOTTANDI': 'requisiti-minori',
    'PASSAGGI DELLA PROCEDURA': 'passaggi',
    'POST ADOZIONE': 'post-adozione',
    'NOTE': 'note'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadStates();
    setupEventListeners();
});

function setupEventListeners() {
    // Search box
    document.getElementById('searchBox').addEventListener('input', filterStates);

    // Highlight buttons
    document.querySelectorAll('.highlight-btn').forEach(btn => {
        btn.addEventListener('click', () => onHighlightButtonClick(btn.dataset.color));
    });
}

async function loadStates() {
    try {
        const response = await fetch('/api/states');
        const states = await response.json();
        const markingsResponse = await fetch('/api/markings');
        const markingsData = await markingsResponse.json();
        
        const stateList = document.getElementById('stateList');
        stateList.innerHTML = '';
        
        states.forEach(state => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.textContent = state;
            
            if (state in markingsData.markings) {
                const marking = markingsData.markings[state];
                item.textContent = `[${marking}] ${state}`;
                item.classList.add(`state-${marking.toLowerCase()}`);
            }
            
            item.addEventListener('click', () => loadState(state));
            stateList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading states:', error);
    }
}

function filterStates() {
    const searchText = document.getElementById('searchBox').value.toLowerCase();
    const items = document.querySelectorAll('#stateList .list-group-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const state = text.includes(']') ? text.split('] ')[1] : text;
        item.style.display = state.includes(searchText) ? '' : 'none';
    });
}

async function loadState(state) {
    try {
        currentState = state;
        const response = await fetch(`/api/state/${state}`);
        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            return;
        }
        
        parseAndDisplayContent(data.content);
        
        // Load and apply highlights
        const markingsResponse = await fetch('/api/markings');
        const markingsData = await markingsResponse.json();
        
        if (state in markingsData.highlights) {
            markingsData.highlights[state].forEach(highlight => {
                applyStoredHighlight(highlight);
            });
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

function parseAndDisplayContent(content) {
    // Clear all sections
    Object.values(sections).forEach(id => {
        document.querySelector(`#${id} .content-section`).innerHTML = '';
    });
    
    // Parse content
    let currentSection = null;
    let sectionContent = '';
    
    const lines = content.split('\n');
    for (const line of lines) {
        // Handle state header
        if (line.startsWith('STATO:')) {
            document.getElementById('stateHeader').textContent = line;
            continue;
        }
        
        // Check for section headers
        let newSection = null;
        for (const [sectionName, sectionId] of Object.entries(sections)) {
            if (line.includes(sectionName)) {
                newSection = sectionName;
                break;
            }
        }
        
        if (newSection) {
            if (currentSection) {
                document.querySelector(`#${sections[currentSection]} .content-section`).innerHTML = 
                    `<div class="content-text">${sectionContent}</div>`;
            }
            currentSection = newSection;
            sectionContent = '';
            continue;
        }
        
        if (currentSection) {
            if (line.startsWith('- ')) {
                sectionContent += `<div class="bullet-point">• ${line.substring(2)}</div>`;
            } else if (line) {
                sectionContent += `<div class="text-line">${line}</div>`;
            }
        }
    }
    
    // Save the last section
    if (currentSection) {
        document.querySelector(`#${sections[currentSection]} .content-section`).innerHTML = 
            `<div class="content-text">${sectionContent}</div>`;
    }
}

async function markState(marking) {
    if (!currentState) return;
    
    try {
        const response = await fetch('/api/mark_state', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state: currentState,
                marking: marking
            })
        });
        
        if (response.ok) {
            loadStates();
        }
    } catch (error) {
        console.error('Error marking state:', error);
    }
}

function getSelectedText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    
    // If we're on a text node, get its parent
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }
    
    const contentSection = node.closest('.content-section');
    if (!contentSection) return null;
    
    const tabPane = contentSection.closest('.tab-pane');
    if (!tabPane) return null;
    
    // Get section name from tab ID
    const sectionId = tabPane.id;
    let sectionName = '';
    for (const [name, id] of Object.entries(sections)) {
        if (id === sectionId) {
            sectionName = name;
            break;
        }
    }
    
    // Get the text content up to the start and end positions
    const fullText = contentSection.textContent;
    const selectedText = selection.toString();
    
    if (!selectedText.trim()) return null;
    
    // Find the actual start position in the full text
    const start = fullText.indexOf(selectedText);
    const end = start + selectedText.length;
    
    console.log('Selected text:', {
        text: selectedText,
        start: start,
        end: end,
        section: sectionName
    });
    
    return {
        text: selectedText,
        start: start,
        end: end,
        section: sectionName
    };
}

async function applyHighlight(color, selectionData = null) {
    if (!currentState) {
        console.error('No state selected');
        return;
    }
    
    const highlight = selectionData || getSelectedText();
    if (!highlight) {
        console.error('No text selected');
        return;
    }
    
    const requestData = {
        state: currentState,
        highlight: {
            section: highlight.section,
            start: highlight.start,
            end: highlight.end,
            color: color,
            text: highlight.text
        }
    };
    
    console.log('Sending highlight request:', requestData);
    
    try {
        const response = await fetch('/api/highlight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const responseData = await response.json();
        console.log('Server response:', responseData);
        
        if (response.ok) {
            // Apply the highlight visually
            applyStoredHighlight(requestData.highlight);
            
            // Update state_markings.json display
            const markingsResponse = await fetch('/api/markings');
            if (markingsResponse.ok) {
                const markingsData = await markingsResponse.json();
                console.log('Updated markings:', markingsData);
            } else {
                console.error('Failed to fetch updated markings:', markingsResponse.statusText);
            }
        } else {
            console.error('Failed to save highlight:', responseData.error || response.statusText);
        }
    } catch (error) {
        console.error('Error applying highlight:', error);
        // Try to apply highlight visually even if saving failed
        applyStoredHighlight(requestData.highlight);
    }
}

async function onHighlightButtonClick(color) {
    console.log('Highlight button clicked:', color);
    const selection = getSelectedText();
    if (!selection) {
        console.log('No text selected');
        return;
    }
    
    try {
        // Store the selection data before clearing it
        const highlightData = {
            section: selection.section,
            start: selection.start,
            end: selection.end,
            text: selection.text.trim(),
            color: color
        };
        
        // Now we can safely clear the selection
        window.getSelection().removeAllRanges();
        
        // Apply the highlight using the stored data
        await applyHighlight(highlightData.color, highlightData);
    } catch (error) {
        console.error('Error in highlight button click handler:', error);
    }
}

function applyStoredHighlight(highlight) {
    const sectionId = sections[highlight.section];
    if (!sectionId) return;
    
    const contentSection = document.querySelector(`#${sectionId} .content-section .content-text`);
    if (!contentSection) return;
    
    const text = contentSection.textContent;
    const before = text.substring(0, highlight.start);
    const highlighted = text.substring(highlight.start, highlight.end);
    const after = text.substring(highlight.end);
    
    // Find the HTML elements that contain the text
    const elements = Array.from(contentSection.children);
    let currentPos = 0;
    let newHtml = '';
    
    for (const element of elements) {
        const elementText = element.textContent;
        const elementEnd = currentPos + elementText.length;
        
        if (highlight.start >= currentPos && highlight.start < elementEnd) {
            // This element contains the start of the highlight
            const beforeHighlight = elementText.substring(0, highlight.start - currentPos);
            const highlightedText = elementText.substring(highlight.start - currentPos, 
                Math.min(highlight.end - currentPos, elementText.length));
            const afterHighlight = elementText.substring(Math.min(highlight.end - currentPos, elementText.length));
            
            newHtml += `<div class="${element.className}">${beforeHighlight}<span class="highlight-${highlight.color}">${highlightedText}</span>${afterHighlight}</div>`;
        } else if (highlight.end > currentPos && highlight.start < currentPos) {
            // This element is entirely within the highlight
            newHtml += `<div class="${element.className}"><span class="highlight-${highlight.color}">${elementText}</span></div>`;
        } else {
            // This element is outside the highlight
            newHtml += element.outerHTML;
        }
        
        currentPos += elementText.length;
    }
    
    contentSection.innerHTML = newHtml;
}

async function saveNotes() {
    if (!currentState) return;
    
    const notesContent = document.querySelector('#note .content-section').innerHTML;
    
    try {
        const response = await fetch('/api/save_notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state: currentState,
                notes: notesContent
            })
        });
        
        if (response.ok) {
            alert('Notes saved successfully!');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Error saving notes. Please try again.');
    }
}
