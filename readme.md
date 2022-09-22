### ImageColor 用于获取一张图片的主题色、明亮色、柔和色以及昏暗色四种颜色！

### Features
- 🚀 简单粗暴高效
- 🔗 Promise调用
- 🎨 返回数据丰富
- 🌌 支持返回颜色分布图谱GC，并生成GC图片保存到本地

### Usage

```
import ImageColor from "./index.js";
let IC = new ImageColor();

IC.analizeImage({
    id: "mycanvas",
    url: './img.png',
    frequency: 20,
}).then((res) => {
    const { primary, colors, pixels, imageInfo } = res;
    console.log("主题色：", primary);
    console.log("三种不同亮度的颜色：", colors);
    console.log("所有像素", pixels);
    console.log("图片信息：", imageInfo);

    // 执行该任务的话-如果响应速度会比较慢的话，可以延迟渲染，保证当前页面渲染流畅
    setTimeout(() => {
        // IC.showGC({ gcid: "graphy_canvas" });
        // IC.saveGCImage('色谱.png'); //需要先调用 showGC
    }, 0);
});
```

### Details

> `IC.analizeImage` 为主要方法，接受一个{对象}作为参数，并以 Promise 的方式返回主题色和三阶亮度颜色

@params

```
{
    id: "mycanvas",
    url: './img.png',
    frequency: 20,
}

/**
* @param {Object} params
* @param params.id String 指定唯一标识，
* @param params.url String 要分析的图片地址
* @param params.frequency Number 采样率，值越大，程序执行速度越快，但是会丢失大部分像素颜色导致精度会下降，默认 20
 */
```

@returns Promise

```
{
    primary: [r,g,b],
    colors: { bright:{...}, soft:{...}, dark:{...} },
    pixels: [[r,g,b],...],
    imageInfo: {}
}

其中{...} = {
    name: "明亮色",
    color: [],//rgb颜色
    yuvOfColor: 0, //亮度
    yuvCount: 0,//
    yuvPercent: 0, //该亮度在图片中的占比
}
```

> `IC.showGC({ gcid: "graphy_canvas" })` 方法用于把图片处理过程中的颜色分布渲染到一个指定的 canvas 上，方便观察！

![色谱实例](./%E8%89%B2%E8%B0%B1demo.png)

> `IC.saveGCImage('filename')` 方法用于把图谱 canvas 保存为本地图片 (需要先调用 showGC)

### 简单粗暴实现思路！

没有用到 8 叉树法或者其他主流算法，目前自己这种简单粗暴的操作已经能够达到预期效果！

- 1.按照指定采样间隔，获取到整张图片的像素点的颜色数据，记作 pixels；
- 2.第一次遍历 pixels，做以下操作：
  - a.计算所有 pixels 的平均 avg_rgb；
  - b.计算每一个 pixel 对应的亮度 yuv 值，并根据 yuv 值分三档亮度[明亮色,柔和色,昏暗色]，将 pixel 的 rgb 加入到对应的亮度颜色的数组中，对这三档色分别累计次数！
- 3.第二次便利 pixels，拿每一个 pixel 的 rgb 与 avg_rgb 做差，差值在指定范围内保留进 diffavg_pixels 数组中，否则丢弃！
- 4.对 diffavg_pixels 求平均的 diff_avg_rgb，即作为 图片的主题色！
- 5.对三档亮度的 pixels 数组 分别求出平均的 rgb，即作为三档亮度颜色！
