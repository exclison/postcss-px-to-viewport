const postcss = require("postcss");

const defaults = {
  unitToConvert: "px", //(String) 需要转换的单位，默认为"px"
  viewportWidth: 320, //(Number) 设计稿的视口宽度
  viewportHeight: 568, //(Number) 设计稿的视口高度
  unitPrecision: 5, //(Number) 单位转换后保留的精度
  viewportUnit: "vw", //(String) 希望使用的视口单位
  fontViewportUnit: "vw", //(String) 字体使用的视口单位
  selectorBlackList: [], //(Array) 需要忽略的CSS选择器
  propList: ["*"], //(Array) 能转化为vw的属性列表
  minPixelValue: 1, //(Number) 设置最小的转换数值，如果为1的话，只有大于1的值会被转换
  mediaQuery: false, //(Boolean) 媒体查询里的单位是否需要转换单位
  replace: true, //(Boolean) 是否直接更换属性值，而不添加备用属性
  landscape: false, //(Boolean) 是否添加根据 landscapeWidth 生成的媒体查询条件 @media (orientation: landscape)
  landscapeUnit: "vw", //(String) 横屏时使用的单位
  landscapeWidth: 568, //(Number) 横屏时使用的视口宽度
};

module.exports = (options = {}) => {
  const opts = Object.assign({}, defaults, options);

  checkRegExpOrArray(opts, "exclude");
  checkRegExpOrArray(opts, "include");

  return {
    postcssPlugin: "postcss-px-to-viewport",
    Once(root, { result }) {
    //   console.log(root, "root");
    //   debugger;
    //   // console.log(result,'result')
    //   root.walkAtRules((atrule) => {
    //       debugger
    //       console.log(atrule,'atrule')
    //   });
    },
    Rule(opt){

        console.log(opt.source.input,'opt')
        console.log('333')
    },
    Declaration (decl) {
        console.log(decl,'decl')
        console.log('333')
        // All declaration nodes
      }
  };
};
module.exports.postcss = true;

//验证参数是否为正则表达式或者正则表达式数组
function checkRegExpOrArray(options, optionName) {
  const option = options[optionName];
  if (!option) return;

  if (queryTypeString(option) === "[object RegExp]") return;
  if (queryTypeString(option) === "[object Array]") {
    const checkRegExp = option.reduce(
      (total, current) =>
        total && queryTypeString(current) === "[object RegExp]",
      true
    );
    if (checkRegExp) return;
  }
  throw new Error(`options ${optionName} should be RegExp or Array of RegExp.`);
}
//获取类型字符串
function queryTypeString(opt) {
  return Object.prototype.toString.call(opt);
}
