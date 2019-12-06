export default {
  choice(dict) {
    return (str) => dict[str];
  },
  timestamp: (timestamp) => {
    const parts = timestamp.split(":");
    return {
      seconds:
        parts.length == 2
          ? 60 * parseInt(parts[0]) + parseInt(parts[1])
          : 60 * 60 * parseInt(parts[0]) +
            60 * parseInt(parts[1]) +
            parseInt(parts[0]),
      timestamp: timestamp,
    };
  },
  color: (color) => {
    if (color == "red") {
      return "#FF0040";
    } else if (color == "yellow") {
      return "#FFDE00";
    } else if (color == "green") {
      return "#00BB66";
    } else if (color == "blue") {
      return "#3020FF";
    } else if (color == "white") {
      return "#FFFFFF";
    } else if (color == "random") {
      const letters = "0123456789ABCDEF";
      var col = "#";
      for (let i = 0; i < 6; i++)
        col += letters[Math.floor(Math.random() * 16)];
      return col;
    } else {
      return color;
    }
  },
};
