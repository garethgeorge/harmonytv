import React from "react";

export default (chatbox) => {
  chatbox.commands = {};

  chatbox.registerCommand = (command, handler, opts = null) => {
    if (!opts) opts = {};

    // if an array is passed, apply the handler to each element
    if (command instanceof Array) {
      for (const cmd of command) {
        chatbox.registerCommand(cmd, handler, opts);
      }
      return;
    }

    // generate html for command usage
    let arglist = null;
    if (!arglist && opts.args) {
      arglist = opts.args.map((arg) => {
        if (arg.optional) {
          return (
            <span className="command-arg optional" key={arg.name}>
              {" [" + arg.name + "]"}
            </span>
          );
        }
        return (
          <span className="command-arg" key={arg.name}>
            {" <" + arg.name + ">"}
          </span>
        );
      });
    }
    const usage = (
      <span className="command">
        {"\\" + command}
        {arglist}
      </span>
    );

    // Validate and parse argstr
    let oldHandler = handler;
    let argHandler = (argstr, stream) => {
      let values = {};
      if (opts && opts.args) {
        const validArgStr = /^\s*(?:(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*(?:[A-Za-z]\w*=(?:(?:[^=\s]|\\=)+|"(?:[^"]|\")*")(?:\s+))*$/;
        if (!(argstr + " ").match(validArgStr)) {
          // if argstr is invalid, throw error.
          chatbox.print(stream, {
            content: (
              <span>
                Invalid argument string{" "}
                <span className="command">{argstr}</span>.
              </span>
            ),
            kind: "error",
          });
          return;
        } else {
          // if argstr is valid...
          //const argSplitter = /(?<=^|\s)((?:[A-Za-z]\w*=)?(?:(?:[^\s="]|\\=)+|".*(?<!\\)"|""))(?=\s|$)/g;
          //const argSplitter = /((?:\w*=)?(?:(?:[^\s="]|\\=)+|".*[^\\]"|""))/gi
          const argSplitter = /(\w+=)?((\\=|\\"|[^\s="])+|".*[^\\]"|"")/gi;
          const splitArgs = Array.from(
            argstr.matchAll(argSplitter),
            (m) => m[0]
          );
          console.log("splitArgs:", splitArgs);
          //const argPartSplitter = /^([A-Za-z]\w*(?==))|((?:[^\s="]|\\=)+|".*(?<!\\)"|"")$/g;
          const argPartSplitter = /^(?:(\w+)=)?((?:\\=|\\"|[^\s="])+|".*[^\\]"|"")$/gi;
          let kwargsParsed = {};
          let posargsParsed = [];
          // get positional and keyword args
          for (const argtext of splitArgs) {
            const argParts = argPartSplitter.exec(argtext);
            argPartSplitter.lastIndex = 0;
            // const argParts = Array.from(
            //   argtext.matchAll(argPartSplitter),
            //   (m) => m[0]
            // );
            if (!argParts[1]) {
              posargsParsed.push(argParts[2]);
            } else {
              kwargsParsed[argParts[1]] = argParts[2];
            }
          }
          // figure out which arguments are which...
          let prevalues = Object.assign({}, kwargsParsed);
          let req = 0;
          for (const arg of opts.args) {
            if (!prevalues.hasOwnProperty(arg.name)) {
              prevalues[arg.name] = null;
              if (!arg.optional) {
                req++;
              }
            }
          }
          let free = posargsParsed.length - req; // parseInt of optional ones to fill.
          let i = 0;
          for (const arg of opts.args) {
            if (prevalues[arg.name] == null) {
              if (!arg.optional) {
                if (i < posargsParsed.length) {
                  prevalues[arg.name] = posargsParsed[i];
                  i++;
                } else {
                  chatbox.print(stream, {
                    content: (
                      <span>
                        Not all required arguments supplied. Expected usage:{" "}
                        <br />
                        {usage}.
                      </span>
                    ),
                    kind: "error",
                  });
                  return;
                }
              } else if (free > 0) {
                prevalues[arg.name] = posargsParsed[i];
                i++;
                free -= 1;
              }
            }
          }
          if (i < posargsParsed.length) {
            chatbox.print(stream, {
              content: (
                <span>
                  More arguments supplied than expected. Expected usage: <br />
                  <span className="command">{usage}</span>.
                </span>
              ),
              kind: "error",
            });
            return;
          }
          for (const arg of opts.args) {
            if (prevalues[arg.name]) {
              if (arg.validate && !arg.validate.test(prevalues[arg.name])) {
                console.log("tested");
                chatbox.print(stream, {
                  content: (
                    <span>
                      Invalid format for{" "}
                      <span className="command command-arg">{arg.name}</span>{" "}
                      argument.
                    </span>
                  ),
                  kind: "error",
                });
                return;
              } else {
                if (prevalues[arg.name][0] == '"') {
                  prevalues[arg.name] = prevalues[arg.name].slice(1, -1);
                }
                if (arg.parse) {
                  values[arg.name] = arg.parse(prevalues[arg.name]);
                } else {
                  values[arg.name] = prevalues[arg.name];
                }
              }
            } else {
              values[arg.name] = arg.hasOwnProperty("fallback")
                ? arg.fallback
                : null;
            }
          }
        }
      } else {
        values = argstr;
      }
      oldHandler(values, stream);
      return;
    };

    handler = argHandler;

    chatbox.commands[command] = {
      command: command,
      handler: handler,
      opts: opts,
      usage: usage,
    };
  };
};
