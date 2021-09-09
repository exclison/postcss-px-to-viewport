const postcss = require("postcss");

const { createPropListMatcher } = require("./src/prop-list-matcher");
const { getUnitRegexp } = require("./src/pixel-unit-regexp");

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
const ignoreNextComment = "px-to-viewport-ignore-next";
const ignorePrevComment = "px-to-viewport-ignore";
module.exports = (options = {}) => {
  const opts = Object.assign({}, defaults, options);

  checkRegExpOrArray(opts, "exclude");
  checkRegExpOrArray(opts, "include");

  const pxRegex = getUnitRegexp(opts.unitToConvert);
  const satisfyPropList = createPropListMatcher(opts.propList);

  return {
    postcssPlugin: "postcss-px-to-viewport",
    prepare(result) {
      return {
        Once(root, { result }) {
          let landscapeRules = [];
          //遍历规则
          root.walkRules((rule) => {
            const file = rule.source.input.file;

            //包含某些文件
            if (opts.include && file) {
              if (queryTypeString(opts.include) === "[object RegExp]") {
                if (!opts.include.test(file)) return;
              }
              if (queryTypeString(opts.include) === "[object Array]") {
                let flag = false;
                for (let i = 0; i < opts.include.length; i++) {
                  if (opts.include[i].test(file)) {
                    flag = true;
                    break;
                  }
                }
                if (!flag) return;
              }
            }

            //排除某些文件
            if (opts.exclude && file) {
              if (queryTypeString(opts.exclude) === "[object RegExp]") {
                if (opts.exclude.test(file)) return;
              }
              if (queryTypeString(opts.exclude) === "[object Array]") {
                for (let i = 0; i < opts.exclude.length; i++) {
                  if (opts.exclude[i].test(file)) return;
                }
              }
            }

            //过滤选择器
            if (blacklistedSelector(opts.selectorBlackList, rule.selector)) {
              return;
            }

            //如果该rule 是媒体查询下的,并且没有mediaQuery属性,则直接返回,不需要处理
            if (rule.parent.params && !opts.mediaQuery) {
              return;
            }

            //遍历属性
            rule.walkDecls((decl) => {

              //过滤掉不需要操作的属性(即value中不含有px等单位的css样式)
              if (decl.value.indexOf(opts.unitToConvert) < 0) {
                return;
              }
              if (!satisfyPropList(decl.prop)) {
                return;
              }

              const prev = decl.prev();

              //忽略有排除注释的属性,类似忽略eslint类型检查
              if (
                prev &&
                prev.type === "comment" &&
                prev.text === ignoreNextComment
              ) {
                prev.remove();
                return;
              }

              const next = decl.next();

              if (
                next &&
                next.type === "comment" &&
                next.text === ignorePrevComment
              ) {
                if (/\n/.test(next.raws.before)) {
                  result.warn(
                    "Unexpected comment /* " +
                      ignorePrevComment +
                      " */ must be after declaration at same line.",
                    { node: next }
                  );
                } else {
                  next.remove();
                  return;
                }
              }

              let unit; //单位
              let size; //视口宽度
              const params = decl.parent.parent.params;

              if (
                opts.landscape &&
                ((params && params.indexOf("landscape") > 0) || !params)
              ) {
                unit = opts.landscapeUnit;
                size = opts.landscapeWidth;
              } else {
                unit = getUnit(decl.prop, opts);
                size = opts.viewportWidth;
              }

              const value = decl.value.replace(
                pxRegex,
                createPxReplace(opts, unit, size)
              );

              if (declarationExists(decl.parent, decl.prop, value)) {
                return;
              }

              if (opts.replace) {
                decl.value = value;
              } else {
                decl.before(decl.clone({ value: value }));
              }
            });

            if (opts.landscape && !rule.parent.params) {
              const landscapeRule = rule.clone();
              if (landscapeRule.nodes.length > 0) {
                landscapeRules.push(landscapeRule);
              }
            }
          });

          if (landscapeRules.length > 0) {
            const landscapeRoot = postcss.atRule({
              params: "(orientation:landscape)",
              name: "media",
            });
            landscapeRules.forEach((rule) => {
              landscapeRoot.append(rule);
            });
            landscapeRules = [];

            root.append(landscapeRoot);
          }
        },
        Rule(rule) {},
        Declaration(decl, { Rule }) {},
        RuleExit(rule) {},
        RootExit(root) {},
      };
    },
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

//验证需要过滤掉的选择器
function blacklistedSelector(blackList, selector) {
  if (typeof selector !== "string") return;

  return blackList.some((regexp) => {
    return typeof regexp === "string"
      ? selector.indexOf(regexp) >= 0
      : selector.match(regexp);
  });
}

//获取单位 正常的单位与文字单位
function getUnit(prop, opts) {
  return prop.indexOf("font") === -1
    ? opts.viewportUnit
    : opts.fontViewportUnit;
}

//px替换为vw
function createPxReplace(opts, viewportUnit, viewportSize) {
  return function (m, $1) {
    if (!$1) return m;
    const pixels = parseFloat($1);
    if (pixels <= opts.minPixelValue) return m;
    const parseVal = toFixed((pixels / viewportSize) * 100, opts.unitPrecision);
    return parseVal === 0 ? "0" : parseVal + viewportUnit;
  };
}
//保留精度
function toFixed(number, precision) {
  const multiplier = Math.pow(10, precision + 1);
  const wholeNumber = Math.floor(number * multiplier);
  return (Math.round(wholeNumber / 10) * 10) / multiplier;
}

//确定是否替换过,替换过的不需要再替换
function declarationExists(decls, prop, value) {
  return decls.some((decl) => decl.prop === prop && decl.value === value);
}
