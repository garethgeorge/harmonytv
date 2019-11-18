export default {
  choice(list) {return new RegExp("^("+list.join('|')+")$");},
  number: /^-?[123456789][0-9]*\.?[0-9]*$/,
  timestamp: /^\d+:[0-5]\d(:[0-5]\d)?(.\d+)?$/,
  percent: /^[123456789][0-9]?\%$/,
  color: /(#([0-9a-f]{3}){1,2}|(rgba|hsla)\(\d{1,3}%?(,\s?\d{1,3}%?){2},\s?(1|0?\.\d+)\)|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?\)){2}|red|yellow|green|blue|white)/i,

//  /(#([0-9a-f]{3}){1,2}|(rgba|hsla)\(\d{1,3}%?(,\s?\d{1,3}%?){2},\s?(1|0?\.\d+)\)|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?\)){2})/i,
// /^(\#[0-9a-fA-F]{6}|rgb\(\s*((1?[0-9]{0,2}|2[0-4][0-9]|25[0-5]),\s*){2}(1?[0-9]{0,2}|2[0-4][0-9]|25[0-5])\s*\))$/,
}

// console.log(chatboxValidaters.choice(["left", "right"]));
