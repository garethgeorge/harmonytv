export default function sortableTitle(title) {
  // remove article from beginning
  let words = title.toLowerCase().split(" ");
  if (words[0] == "a" || words[0] == "an" || words[0] == "the") {
    words.shift();
  }
  let noArticleTitle = words.join(" ");

  return noArticleTitle;
}
