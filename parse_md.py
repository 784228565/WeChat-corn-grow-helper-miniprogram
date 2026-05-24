import re
import json

with open('24_scenarios_detailed_calendar.md', 'r', encoding='utf-8') as f:
    text = f.read()

scenario_blocks = re.split(r'\n---\s*\n', text)

scenarios_data = {}

for block in scenario_blocks:
    block = block.strip()
    if not block or not block.startswith('## 方案'):
        continue
    
    header_match = re.match(r'## 方案 #(\d+)：(.+?) · (.+?) · (.+?)\n', block)
    if not header_match:
        continue
    
    sid = int(header_match.group(1))
    temp = header_match.group(2)
    soil = header_match.group(3)
    irrigation = header_match.group(4)
    
    # Extract metadata
    meta_match = re.search(r'\*\*目标产量\*\*：(.+?) ｜', block)
    target_yield = meta_match.group(1).strip() if meta_match else ''
    
    meta_match2 = re.search(r'\*\*播种期\*\*：(.+?) ｜', block)
    sowing_date = meta_match2.group(1).strip() if meta_match2 else ''
    
    # Extract tasks
    task_sections = re.findall(
        r'### \d+\. (.+?)\n'
        r'\*\*时间\*\*：(.+?)\n\n'
        r'\*\*操作内容\*\*：\n'
        r'((?:- .+?\n)+)'
        r'\n'
        r'\*\*时间理由\*\*：(.+?)(?=\n###|\n---|$)',
        block, re.DOTALL
    )
    
    nodes = []
    for idx, (title, date, details_text, reason) in enumerate(task_sections, 1):
        details = [d.strip()[2:].strip() for d in details_text.strip().split('\n') if d.strip().startswith('-')]
        
        # Parse primary date for status calculation
        target_date = ''
        m = re.search(r'(\d{1,2})月(\d{1,2})日', date)
        if m:
            target_date = f"{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        else:
            m = re.search(r'(\d{1,2})/(\d{1,2})', date)
            if m:
                target_date = f"{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        
        nodes.append({
            'id': 'n' + str(idx),
            'index': idx,
            'title': title.strip(),
            'date': date.strip(),
            'targetDate': target_date,
            'details': details,
            'reason': reason.strip()
        })
    
    scenarios_data[str(sid)] = {
        'id': sid,
        'temp': temp,
        'soil': soil,
        'irrigation': irrigation,
        'targetYield': target_yield,
        'sowingDate': sowing_date,
        'nodes': nodes
    }

# Verify
print('Parsed ' + str(len(scenarios_data)) + ' scenarios')
for sid, data in scenarios_data.items():
    print('  #' + str(sid) + ': ' + data['temp'] + '/' + data['soil'] + '/' + data['irrigation'] + ' -> ' + str(len(data['nodes'])) + ' nodes')

# Write to JS file
with open('utils/scenarioCalendars.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from 24_scenarios_detailed_calendar.md\n')
    f.write('// Each scenario contains a chronological node array.\n')
    f.write('// Each node = one check-in point with title, date, details (checklist), and reasoning.\n')
    f.write('module.exports = ' + json.dumps(scenarios_data, ensure_ascii=False, indent=2) + ';\n')

print('\nWritten to utils/scenarioCalendars.js')
