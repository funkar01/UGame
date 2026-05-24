const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const insertion = `
          <div style="margin-bottom: 1.5rem; text-align: center;">
            <label for="room-id" style="color: white; font-weight: bold; display: block; margin-bottom: 0.5rem;">Room ID (Optional)</label>
            <input type="text" id="room-id" placeholder="Enter Room ID to join..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: rgba(0,0,0,0.5); color: white; font-size: 1rem; text-align: center; box-sizing: border-box;">
          </div>
`;

// Insert it right before pc-instructions
html = html.replace('<div id="pc-instructions"', insertion + '          <div id="pc-instructions"');
fs.writeFileSync('index.html', html);
console.log('Successfully added Room ID input to index.html');
