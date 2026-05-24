const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = '<button id="btn-team-blue" class="btn" style="background: #3b82f6; color: white; flex: 1; border: 2px solid transparent;">Team Blue</button>\r\n          </div>';
const replacement = '<button id="btn-team-blue" class="btn" style="background: #3b82f6; color: white; flex: 1; border: 2px solid transparent;">Team Blue</button>\r\n          </div>\r\n\r\n          <div class="room-input-container" style="margin-bottom: 1.5rem;">\r\n            <label for="room-id" style="display: block; font-size: 0.9rem; margin-bottom: 0.5rem; color: #cbd5e1; text-align: center;">Room ID (Optional)</label>\r\n            <input type="text" id="room-id" placeholder="Enter Room Name" style="width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; font-family: \'Outfit\', sans-serif; font-size: 1rem; text-align: center;">\r\n          </div>';

if (html.includes(target)) {
  html = html.replace(target, replacement);
} else {
  // Try with just \n
  const target2 = '<button id="btn-team-blue" class="btn" style="background: #3b82f6; color: white; flex: 1; border: 2px solid transparent;">Team Blue</button>\n          </div>';
  const replacement2 = '<button id="btn-team-blue" class="btn" style="background: #3b82f6; color: white; flex: 1; border: 2px solid transparent;">Team Blue</button>\n          </div>\n\n          <div class="room-input-container" style="margin-bottom: 1.5rem;">\n            <label for="room-id" style="display: block; font-size: 0.9rem; margin-bottom: 0.5rem; color: #cbd5e1; text-align: center;">Room ID (Optional)</label>\n            <input type="text" id="room-id" placeholder="Enter Room Name" style="width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; font-family: \'Outfit\', sans-serif; font-size: 1rem; text-align: center;">\n          </div>';
  html = html.replace(target2, replacement2);
}

fs.writeFileSync('index.html', html);
console.log('Room ID fixed!');
