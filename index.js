export default class ImageColor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.img = null;
    this.imageInfo = {};
    this.dpr = 1; //dpr || window.devicePixelRatio;
    this.gcCanvas = null; //色谱canvas

    this.pixels = [];
    this.primaryColor = []; //主题色
    this.colors = []; //主题色和三种亮度的颜色形成的集合
    this.colorInfo = {
      bright: {
        name: "明亮色",
        color: [],
        yuvOfColor: 0, //亮度
        yuvCount: 0,
        yuvPercent: 0,
      },
      soft: {
        name: "柔和色",
        color: [],
        yuvOfColor: 0, //亮度
        yuvCount: 0,
        yuvPercent: 0,
      },
      dark: {
        name: "昏暗色",
        color: [],
        yuvOfColor: 0, //亮度
        yuvCount: 0,
        yuvPercent: 0,
      },
    };
  }

  /**
   * 图片数据解析
   * @param {Object} params
   * @param params.id String 指定唯一标识，
   * @param params.url String 要分析的图片地址
   * @param params.frequency Number 采样率，值越大，程序执行速度越快，但是会丢失大部分像素颜色导致精度会下降，默认 20
   * @returns
   */
  analizeImage({ id, url, frequency = 20 }) {
    return new Promise(async (resolve, reject) => {
      let imgInfo = {};
      let canvas = document.querySelector(`#${id}`);
      if (!canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = id;
      } else {
        this.canvas = canvas;
      }
      this.ctx = this.canvas.getContext("2d");
      try {
        imgInfo = await this.loadImage(url);
        this.imageInfo = imgInfo;
      } catch (err) {
        return reject({
          msg: "图片加载失败",
          ...err,
        });
      }
      this.img = imgInfo.img;

      this.canvas.width = `${imgInfo.width}`;
      this.canvas.height = `${imgInfo.height}`;
      this.canvas.style.width = `${imgInfo.width}px`;
      this.canvas.style.height = `${imgInfo.height}px`;

      // document.body.appendChild(this.canvas);

      let w = imgInfo.width;
      let h = imgInfo.height;
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);

      this.createPixels(frequency);
      this.analizePixels();

      resolve({
        primary: this.primaryColor,
        colors: this.colorInfo,
        pixels: this.pixels,
        imageInfo: this.imageInfo,
      });
    });
  }

  /**
   * 根据指定的采样率间隙，读取图片像素信息
   * @param {Number} frequency
   * @returns pixelArray
   */
  createPixels(frequency) {
    const pixelCount = this.canvas.width * this.canvas.height;
    const pixels = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    ).data;
    const pixelArray = [];

    for (let i = 0, offset, r, g, b, a; i < pixelCount; i = i + frequency) {
      offset = i * 4;
      r = pixels[offset + 0];
      g = pixels[offset + 1];
      b = pixels[offset + 2];
      a = pixels[offset + 3];

      // 只提取非透明且不是白色的像素数据
      if (typeof a === "undefined" || a >= 125) {
        if (!(r > 250 && g > 250 && b > 250)) {
          pixelArray.push([r, g, b]);
        }
      }
    }
    // console.log("pixelArray:", pixelArray);
    this.pixels = pixelArray;
    return pixelArray;
  }

  /**
   * 生成图片颜色分布的二维色谱
   * @param {*} params
   * @param params.gcid String 用于展示色谱的canvas的id
   */
  showGC({ gcid = "#graphy_canvas" }) {
    return new Promise((resolve, reject) => {
      let canvas = document.querySelector(`#${gcid}`);
      let ctx = canvas.getContext("2d");
      let size = 512;
      let dpr2 = 2;
      let dpr = 4; //r,g,b的范围[0,256],canvas.width=4倍的r,g,b
      let beyoundHeight = 300;
      canvas.width = size * dpr2;
      canvas.height = size * dpr2 + beyoundHeight;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size + beyoundHeight / dpr2}px`;
      this.gcCanvas = canvas;

      // 生成色谱点集
      this.pixels.map((item) => {
        let [r, g, b] = item;
        ctx.fillStyle = `rgb(${[...item]})`;
        ctx.fillRect(r * dpr, g * dpr, dpr, dpr);
      });

      // 生成提取的主要颜色标识圆圈
      try {
        let colors = this.colors;
        for (let i = 0; i < colors.length; i++) {
          let r = 30 * dpr;
          let parts = 255 / colors.length;
          let x = parts * i + parts / 2;

          this.drawCircle(
            {
              x: x * dpr,
              y: canvas.height - r,
              r: r,
              fillStyle: `rgb(${[...colors[i]]})`,
              strokeStyle: "white",
              borderWidth: 4,
            },
            ctx
          );
        }
      } catch (err) {
        return reject({ msg: "生成主要颜色失败", ...err });
      }

      resolve({ msg: "generate gc success" });
    });
  }

  analizePixels() {
    let diffOffset = 40;
    let brightPixels = [],
      softPixels = [],
      darkPixels = [];
    let yMap = {
      bright: 0,
      middle: 0,
      dark: 0,
    };

    this.pixels.map((item) => {
      let [r, g, b] = item;
      // rgb转换成yuv格式，可以根据y（亮度）分布占比推荐主题色
      let y = this.rgb2yuv(r, g, b);
      if (y >= 170) {
        // 浅色
        brightPixels.push(item);
        yMap.bright++;
        this.colorInfo.bright.yuvCount++;
      } else if (y >= 85) {
        // 中色
        softPixels.push(item);
        yMap.middle++;
        this.colorInfo.soft.yuvCount++;
      } else {
        // 深色
        darkPixels.push(item);
        yMap.dark++;
        this.colorInfo.dark.yuvCount++;
      }
    });

    let totalYUV = this.pixels.length;
    const { bright = 0, middle = 0, dark = 0 } = yMap;

    // 计算三种亮度的占比
    this.colorInfo.bright.yuvPercent =
      Math.round((bright / totalYUV) * 100000) / 1000;
    this.colorInfo.soft.yuvPercent =
      Math.round((middle / totalYUV) * 100000) / 1000;
    this.colorInfo.dark.yuvPercent =
      Math.round((dark / totalYUV) * 100000) / 1000;

    // 计算color
    let avgPrimaryColor = this.calcAvgColor(this.pixels, "primary");
    let avgDiffPrimaryColor = this.getDiffAvgPrimaryColor(
      this.pixels,
      avgPrimaryColor,
      diffOffset
    );
    let avgBrightColor = this.calcAvgColor(brightPixels, "bright");
    let avgSoftColor = this.calcAvgColor(softPixels, "soft");
    let avgDarkColor = this.calcAvgColor(darkPixels, "dark");

    this.primaryColor = avgDiffPrimaryColor;
    this.colorInfo.bright.color = avgBrightColor;
    this.colorInfo.soft.color = avgSoftColor;
    this.colorInfo.dark.color = avgDarkColor;

    // 计算Contrast Color （对比色）
    this.colorInfo.bright.contrastColor = this.getContrastColor(avgBrightColor);
    this.colorInfo.soft.contrastColor = this.getContrastColor(avgSoftColor);
    this.colorInfo.dark.contrastColor = this.getContrastColor(avgDarkColor);

    // 计算颜色的yuv（亮度）
    this.colorInfo.bright.yuvOfColor = this.getYUV(avgBrightColor);
    this.colorInfo.soft.yuvOfColor = this.getYUV(avgSoftColor);
    this.colorInfo.dark.yuvOfColor = this.getYUV(avgDarkColor);

    let colors = [
      avgDiffPrimaryColor,
      avgBrightColor,
      avgSoftColor,
      avgDarkColor,
    ];
    colors = colors.filter((item) => item);
    this.colors = colors;
  }

  getDiffAvgPrimaryColor(pixels, avgPrimaryColor, offset = 40) {
    // 提取与平均色差值在规定范围内的像素颜色数据
    let avgDiffPrimaryPixels = [];
    let [r, g, b] = avgPrimaryColor;
    pixels.map((item) => {
      if (
        item[0] - r <= offset &&
        item[1] - g <= offset &&
        item[2] - b <= offset
      ) {
        avgDiffPrimaryPixels.push(item);
      }
    });

    let avgDiffPrimaryColor = this.calcAvgColor(
      avgDiffPrimaryPixels,
      "diff-primary"
    );

    return avgDiffPrimaryColor;
  }

  calcAvgColor(pixels = [], type = "平均色值") {
    let len = pixels.length;
    if (!len) {
      console.log(`no 「${type}」 pixels`);
      return null;
    }
    let R = 0;
    let G = 0;
    let B = 0;
    pixels.map((item) => {
      R += item[0];
      G += item[1];
      B += item[2];
    });

    let res = [Math.round(R / len), Math.round(G / len), Math.round(B / len)];
    // console.log(type, ": ", res);
    return res;
  }

  getMaxColor() {
    let maxYuvColor = { yuvPercent: 0 };
    for (let key in this.colorInfo) {
      let { yuvPercent } = this.colorInfo[key];
      if (yuvPercent > maxYuvColor.yuvPercent) {
        maxYuvColor = { ...this.colorInfo[key] };
      }
    }
    return maxYuvColor;
  }

  getContrastColor(rgb) {
    if (!rgb || !rgb.length) {
      return null;
    }
    return [255 - rgb[0], 255 - rgb[1], 255 - rgb[2]];
  }

  getYUV(rgb) {
    if (!rgb || !rgb.length) {
      return null;
    }
    return this.rgb2yuv(rgb[0], rgb[1], rgb[2]);
  }

  /**rgb转亮度yuv */
  rgb2yuv(r = 0, g = 0, b = 0) {
    return r * 0.299 + g * 0.578 + b * 0.114;
  }

  drawCircle(options, ctx = this.ctx) {
    const {
      x,
      y,
      r,
      sAngle = 0,
      eAngle = 2,
      strokeStyle = "#000",
      fillStyle = "transparent",
      counterclockwise = false,
      borderWidth = 1,
      fill = true,
    } = options;
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = borderWidth;
    ctx.fillStyle = fillStyle;
    ctx.arc(x, y, r, sAngle, eAngle * Math.PI, counterclockwise);
    if (fillStyle) {
      ctx.fill(); //开始填充
    }
    ctx.stroke(); //stroke() 方法默认颜色是黑色（如果没有上面一行，则会是黑色）。
    ctx.closePath();
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      let img = new Image();
      img.crossOrigin = "Anonymous"; //解决跨域图片问题
      img.onload = (e) => {
        resolve({
          img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          whRatio: (img.naturalWidth / img.naturalHeight).toFixed(2) * 1,
          hwRatio: (img.naturalHeight / img.naturalWidth).toFixed(2) * 1,
        });
      };
      img.onerror = (err) => {
        reject(err);
      };
      img.src = src;
    });
  }

  saveGCImage(filename) {
    return new Promise((resolve, reject) => {
      try {
        this.gcCanvas.toBlob((blob) => {
          if (window.navigator.msSaveOrOpenBlob) {
            navigator.msSaveBlob(blob, filename);
          } else {
            const link = document.createElement("a");
            const body = document.querySelector("body");

            link.href = window.URL.createObjectURL(blob);
            link.download = filename;

            // fix Firefox
            link.style.display = "none";
            body.appendChild(link);

            try {
              link.click();
            } catch (err) {
              reject({ msg: "下载失败:", err });
            }
            body.removeChild(link);
            window.URL.revokeObjectURL(link.href);

            resolve("下载成功");
          }
        });
      } catch (err) {
        this.fail(err);
        reject({ msg: "下载失败:", err });
      }
    });
  }

  sleep(ms = 1000) {
    return new Promise((resolve) => {
      setTimeout(() => {
        return resolve();
      }, ms);
    });
  }
}
