let currentState = null;
const sections = {
    'REQUISITI DELLE COPPIE ADOTTANTI': 'requisiti-coppie',
    'REQUISITI DEI MINORI ADOTTANDI': 'requisiti-minori',
    'PASSAGGI DELLA PROCEDURA': 'passaggi',
    'POST ADOZIONE': 'post-adozione',
    'NOTE': 'note'
};

let serverWarmupTimeout;
let keepAliveInterval;

// Function to start the keep-alive ping
function startKeepAlive() {
    // Clear any existing interval
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    
    // Ping the server every 4 minutes to keep it alive
    keepAliveInterval = setInterval(() => {
        fetch('/ping')
            .catch(error => console.log('Keep-alive ping failed:', error));
    }, 240000); // 4 minutes
}

// Function to show loading state
function showLoadingState() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'server-warming';
    loadingDiv.innerHTML = `
        <div class="loading-message">
            <p>Il server si sta avviando...</p>
            <p>Questo potrebbe richiedere fino a 50 secondi.</p>
            <div class="loading-spinner"></div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

// Function to hide loading state
function hideLoadingState() {
    const loadingDiv = document.getElementById('server-warming');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    if (serverWarmupTimeout) {
        clearTimeout(serverWarmupTimeout);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadStates();
    setupEventListeners();
});

let contentSearchTimeout = null;
let lastContentSearch = '';
let currentSearchQuery = '';
let searchResults = {};

function setupEventListeners() {
    // Search box for state names
    document.getElementById('searchBox').addEventListener('input', filterStates);

    // Content search box
    const contentSearchBox = document.getElementById('contentSearchBox');
    contentSearchBox.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Don't search if query is too short or same as last search
        if (query === lastContentSearch) return;
        lastContentSearch = query;

        // Clear previous timeout
        if (contentSearchTimeout) {
            clearTimeout(contentSearchTimeout);
        }

        // Set new timeout to avoid too many requests
        contentSearchTimeout = setTimeout(() => {
            searchStateContent(query);
        }, 300);
    });

    // Clear content search button
    document.getElementById('clearContentSearch').addEventListener('click', () => {
        document.getElementById('contentSearchBox').value = '';
        lastContentSearch = '';
        loadStates(); // Reset to show all states
    });

    // Highlight buttons
    document.querySelectorAll('.highlight-btn').forEach(btn => {
        btn.addEventListener('click', () => onHighlightButtonClick(btn.dataset.color));
    });
}

async function loadStates() {
    try {
        showLoadingState();
        serverWarmupTimeout = setTimeout(() => {
            // Only show the loading state if the request takes more than 1 second
        }, 1000);

        const response = await fetch('/api/states');
        hideLoadingState();
        
        if (response.ok) {
            const states = await response.json();
            // Start keep-alive after successful connection
            startKeepAlive();
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
        }
    } catch (error) {
        console.error('Error loading states:', error);
        hideLoadingState();
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

async function loadState(state, fromSearch = false) {
    try {
        currentState = state;
        document.getElementById('stateHeader').textContent = state;
        
        const response = await fetch(`/api/state/${state}`);
        const data = await response.json();
        
        if (data.error) {
            console.error(data.error);
            return;
        }
        
        // First, parse and display content normally
        parseAndDisplayContent(data.content);
        
        // Then, if there's a search query active, highlight the terms
        const searchBox = document.getElementById('contentSearchBox');
        const searchQuery = searchBox.value.trim();
        if (searchQuery) {
            highlightSearchTerms(searchQuery);
        }

        // Load and apply highlights
        const markingsResponse = await fetch('/api/markings');
        const markingsData = await markingsResponse.json();
        
        if (markingsData.highlights && markingsData.highlights[state]) {
            markingsData.highlights[state].forEach(highlight => {
                applyStoredHighlight(highlight);
            });
        }

        // Update badges
        updateBadges(state);
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

function highlightSearchTerms(query) {
    if (!query) return;

    // Get all content sections
    Object.values(sections).forEach(sectionId => {
        const contentDiv = document.querySelector(`#${sectionId} .content-section`);
        if (contentDiv && contentDiv.innerHTML) {
            let content = contentDiv.innerHTML;
            
            // Escape special regex characters but keep spaces
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Convert spaces to match any whitespace
            const searchPattern = escapedQuery.split(/\s+/).join('\\s+');
            
            // Create regex to match the exact sequence
            const regex = new RegExp(`(${searchPattern})`, 'gi');
            content = content.replace(regex, '<span class="search-highlight">$1</span>');
            
            contentDiv.innerHTML = content;
        }
    });
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

async function onHighlightButtonClick(color) {
    console.log('Highlight button clicked:', color);
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        console.log('No text selected');
        return;
    }

    // For removing highlights
    if (color === 'none') {
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;

        // If we're on a text node, get its parent
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }

        // Find the highlight span that contains the selection
        while (node && (!node.classList || !Array.from(node.classList).some(c => c.startsWith('highlight-')))) {
            node = node.parentNode;
            if (!node || node.classList === undefined) break;
        }

        // If we found a highlight span, remove only that one
        if (node && node.classList && Array.from(node.classList).some(c => c.startsWith('highlight-'))) {
            const tabPane = node.closest('.tab-pane');
            if (!tabPane) return;

            // Get section name from tab ID
            const sectionId = tabPane.id;
            let sectionName = '';
            for (const [name, id] of Object.entries(sections)) {
                if (id === sectionId) {
                    sectionName = name;
                    break;
                }
            }

            // Find the start and end positions
            const contentSection = tabPane.querySelector('.content-section');
            const fullText = contentSection.textContent;
            const text = node.textContent;
            const start = fullText.indexOf(text);
            const end = start + text.length;

            // Remove highlight visually
            const parent = node.parentNode;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
            window.getSelection().removeAllRanges();

            // Remove highlight from server
            try {
                const response = await fetch('/api/remove_highlight', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        state: currentState,
                        section: sectionName,
                        start: start,
                        end: end
                    })
                });

                if (!response.ok) {
                    console.error('Failed to remove highlight from server');
                }
            } catch (error) {
                console.error('Error removing highlight from server:', error);
            }
        }
        return;
    }

    // For adding highlights
    const selectionData = getSelectedText();
    if (!selectionData) {
        console.log('No valid text selected');
        return;
    }
    
    try {
        // Store the selection data before clearing it
        const highlightData = {
            section: selectionData.section,
            start: selectionData.start,
            end: selectionData.end,
            text: selectionData.text.trim(),
            color: color
        };
        
        // Now we can safely clear the selection
        window.getSelection().removeAllRanges();
        
        // Apply the highlight using the stored data
        await applyHighlight(highlightData.color, highlightData);
    } catch (error) {
        console.error('Error in highlight button click handler:', error);
    }

    // After applying or removing highlight, update badges
    updateBadges(currentState);
}

async function applyHighlight(color, selectionData = null) {
    if (!currentState && !selectionData) {
        console.error('No state selected');
        return;
    }

    const highlight = selectionData;
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

    try {
        const response = await fetch('/api/highlight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const responseData = await response.json();
        
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

function getAllTextNodes(node) {
    const textNodes = [];
    const walk = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip empty text nodes
                if (node.textContent.trim() === '') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let current;
    while (current = walk.nextNode()) {
        textNodes.push(current);
    }
    return textNodes;
}

function applyStoredHighlight(highlight) {
    const sectionId = sections[highlight.section];
    if (!sectionId) return;
    
    const contentSection = document.querySelector(`#${sectionId} .content-section`);
    if (!contentSection) return;
    
    const text = contentSection.textContent;
    if (!text) return;

    // Find the text node containing our target text
    const range = document.createRange();
    const textNodes = getAllTextNodes(contentSection);
    let currentOffset = 0;
    let startNode = null;
    let startNodeOffset = 0;
    let endNode = null;
    let endNodeOffset = 0;

    // Find start and end nodes
    for (const node of textNodes) {
        const nodeLength = node.textContent.length;
        
        if (!startNode && currentOffset + nodeLength > highlight.start) {
            startNode = node;
            startNodeOffset = highlight.start - currentOffset;
        }
        
        if (!endNode && currentOffset + nodeLength >= highlight.end) {
            endNode = node;
            endNodeOffset = highlight.end - currentOffset;
            break;
        }
        
        currentOffset += nodeLength;
    }

    if (!startNode || !endNode) return;

    // Create and position the range
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);

    // Create highlight span
    const span = document.createElement('span');
    span.className = `highlight-${highlight.color}`;

    // Preserve the original HTML structure
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);

    // Clean up any empty text nodes
    contentSection.normalize();
}

function updateBadges(state) {
    // Hide all badges first
    document.querySelectorAll('.highlight-badge').forEach(badge => badge.classList.add('d-none'));
    document.querySelector('.note-badge').classList.add('d-none');

    // If no state is selected, return
    if (!state) return;

    // Get the markings data
    fetch('/api/markings')
        .then(response => response.json())
        .then(markingsData => {
            // Check for highlights
            if (state in markingsData.highlights) {
                const highlights = markingsData.highlights[state];
                // Create a set of sections with highlights
                const sectionsWithHighlights = new Set(highlights.map(h => h.section));
                
                // Show badges for sections with highlights
                sectionsWithHighlights.forEach(sectionName => {
                    const sectionId = sections[sectionName];
                    const link = document.querySelector(`a[href="#${sectionId}"]`);
                    if (link) {
                        const badge = link.querySelector('.highlight-badge');
                        if (badge) badge.classList.remove('d-none');
                    }
                });
            }

            // Check for notes
            const noteSection = document.querySelector('#note .content-section');
            if (noteSection && noteSection.textContent.trim()) {
                const noteBadge = document.querySelector('.note-badge');
                if (noteBadge) noteBadge.classList.remove('d-none');
            }
        })
        .catch(error => console.error('Error updating badges:', error));
}

async function saveNotes() {
    const notesSection = document.querySelector('#note .content-section');
    const notes = notesSection.innerHTML;
    
    try {
        const response = await fetch('/api/save_notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state: currentState,
                notes: notes
            })
        });
        
        if (response.ok) {
            console.log('Notes saved successfully');
            // Update badges after saving notes
            updateBadges(currentState);
        } else {
            console.error('Failed to save notes');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
    }
}

async function searchStateContent(query) {
    try {
        currentSearchQuery = query;
        
        if (!query) {
            loadStates(); // Reset to show all states
            if (currentState) {
                const response = await fetch(`/api/state/${currentState}`);
                const data = await response.json();
                parseAndDisplayContent(data.content);
            }
            return;
        }

        const response = await fetch(`/api/search_content?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Store search results for later use
        searchResults = data.content;
        
        // Update state list to show only matching states
        const stateList = document.getElementById('stateList');
        stateList.innerHTML = '';
        
        const markingsResponse = await fetch('/api/markings');
        const markingsData = await markingsResponse.json();
        
        data.states.forEach(state => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.textContent = state;
            
            if (state in markingsData.markings) {
                const marking = markingsData.markings[state];
                item.textContent = `[${marking}] ${state}`;
                item.classList.add(`state-${marking.toLowerCase()}`);
            }
            
            item.addEventListener('click', () => {
                loadState(state, true); // true indicates this is from search results
            });
            stateList.appendChild(item);
        });

        if (data.states.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'list-group-item text-muted';
            noResults.textContent = 'No states found containing the search text';
            stateList.appendChild(noResults);
        }

    } catch (error) {
        console.error('Error searching state content:', error);
    }
}

function displayContentWithHighlights(content, query) {
    // Split content into sections
    const lines = content.split('\n');
    const sections = {
        'REQUISITI DELLE COPPIE ADOTTANTI': 'requisiti-coppie',
        'REQUISITI DEI MINORI ADOTTANDI': 'requisiti-minori',
        'PASSAGGI DELLA PROCEDURA': 'passaggi',
        'POST ADOZIONE': 'post-adozione',
        'NOTE': 'note'
    };
    
    let currentSection = null;
    let currentContent = [];
    
    // Process content into sections
    for (const line of lines) {
        if (line.trim() in sections) {
            if (currentSection) {
                // Display the completed section
                const sectionId = sections[currentSection];
                const contentDiv = document.querySelector(`#${sectionId} .content-section`);
                if (contentDiv) {
                    let sectionContent = currentContent.join('\n');
                    // Apply highlighting
                    const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
                    searchTerms.forEach(term => {
                        const regex = new RegExp(`(${term})`, 'gi');
                        sectionContent = sectionContent.replace(regex, '<span class="search-highlight">$1</span>');
                    });
                    contentDiv.innerHTML = sectionContent;
                }
            }
            currentSection = line.trim();
            currentContent = [];
        } else if (currentSection) {
            currentContent.push(line);
        }
    }
    
    // Handle the last section
    if (currentSection) {
        const sectionId = sections[currentSection];
        const contentDiv = document.querySelector(`#${sectionId} .content-section`);
        if (contentDiv) {
            let sectionContent = currentContent.join('\n');
            // Apply highlighting
            const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
            searchTerms.forEach(term => {
                const regex = new RegExp(`(${term})`, 'gi');
                sectionContent = sectionContent.replace(regex, '<span class="search-highlight">$1</span>');
            });
            contentDiv.innerHTML = sectionContent;
        }
    }

    // Clear any sections that didn't have content
    Object.values(sections).forEach(sectionId => {
        const contentDiv = document.querySelector(`#${sectionId} .content-section`);
        if (contentDiv && !contentDiv.innerHTML) {
            contentDiv.innerHTML = '';
        }
    });
}
