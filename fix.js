const fs = require('fs');
let s = fs.readFileSync('src/components/CompareView.tsx', 'utf8');

const t1 = "70 Overbought</span>";
const t2 = "{/* ── Metrics Comparison Table ── */}";

const i1 = s.indexOf(t1);
const i2 = s.indexOf(t2, i1);

if (i1 > -1 && i2 > -1) {
    const head = s.slice(0, i1 + t1.length);
    const tail = s.slice(i2);
    
    const insert = "\n                        <span className=\"text-[#8ff5ff]\">30 Oversold</span>\n                    </div>\n                </div>\n                <div className=\"h-[180px]\">\n                    <Line data={rsiChartData} options={rsiOptions} />\n                </div>\n            </div>\n\n            ";
            
    const newContent = head + insert + tail.replace(/^\s*/, '');
    fs.writeFileSync('src/components/CompareView.tsx', newContent, 'utf8');
    console.log("Fixed! Length: " + newContent.length);
} else {
    console.log("Not found.");
}
