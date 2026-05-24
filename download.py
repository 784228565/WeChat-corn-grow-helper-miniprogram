
import requests
import numpy as np
from PIL import Image
import io
import math

def deg2tile(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

# 治丰村中心向南偏移（纬度降低）
lat_center, lon_center = 40.815, 107.450735  # 向南偏移约0.012度
zoom = 16

cx, cy = deg2tile(lat_center, lon_center, zoom)
print(f"向南偏移后中心瓦片: x={cx}, y={cy}")

# 增加向南的瓦片数量（下方更多）
dx_range = range(cx-1, cx+1)   # x方向10个
dy_range = range(cy-2, cy+5)   # y方向10个，向南更多

esri_url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

tiles = {}
failed = 0
for x in dx_range:
    for y in dy_range:
        url = esri_url.format(z=zoom, y=y, x=x)
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200 and len(r.content) > 100:
                img = Image.open(io.BytesIO(r.content))
                tiles[(x, y)] = np.array(img)
            else:
                failed += 1
        except Exception as e:
            failed += 1

print(f"下载 {len(tiles)} 张瓦片, 失败 {failed}")

# 拼接
x_min = min(x for x, y in tiles)
x_max = max(x for x, y in tiles)
y_min = min(y for x, y in tiles)
y_max = max(y for x, y in tiles)

nx = x_max - x_min + 1
ny = y_max - y_min + 1
merged = np.zeros((ny * 256, nx * 256, 3), dtype=np.uint8)

for (x, y), tile in tiles.items():
    ix = x - x_min
    iy = y - y_min
    merged[iy * 256:(iy + 1) * 256, ix * 256:(ix + 1) * 256] = tile

print(f"拼接图尺寸: {merged.shape}")

# 保存
Image.fromarray(merged).save('/mnt/agents/output/治丰村_卫星图_高清_向南偏移.png', 'PNG')

import matplotlib.pyplot as plt
plt.figure(figsize=(16, 16))
plt.imshow(merged)
plt.title(f'治丰村高清卫星图 - 向南偏移 ({merged.shape[1]}x{merged.shape[0]})', fontsize=14)
plt.axis('off')
plt.show()

print("向南偏移版已保存")
