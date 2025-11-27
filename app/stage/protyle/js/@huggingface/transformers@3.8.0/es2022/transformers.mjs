/* esm.sh - @huggingface/transformers@3.8.0 */
import __Process$ from "/stage/protyle/js/node/process.mjs";
import {Buffer as __Buffer$} from "/stage/protyle/js/node/buffer.mjs";
import * as Ou from "/stage/protyle/js/onnxruntime-common@1.23.2/es2022/onnxruntime-common.mjs";
import * as Bu from "/stage/protyle/js/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/es2022/onnxruntime-web.mjs";
var ju = {
    "onnxruntime-common": (de => {
        de.exports = Ou
    }
    ),
    "onnxruntime-web": (de => {
        de.exports = Bu
    }
    ),
    "?2ce3": ( () => {}
    ),
    "?7992": ( () => {}
    ),
    "?5af5": ( () => {}
    ),
    "?2b25": ( () => {}
    ),
    "?db59": ( () => {}
    ),
    "?383f": ( () => {}
    ),
    "?fa4b": ( () => {}
    ),
    "./node_modules/@huggingface/jinja/dist/index.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Environment: () => $e,
            Interpreter: () => Ze,
            Template: () => As,
            parse: () => ae,
            tokenize: () => L
        });
        var l = Object.freeze({
            Text: "Text",
            NumericLiteral: "NumericLiteral",
            StringLiteral: "StringLiteral",
            Identifier: "Identifier",
            Equals: "Equals",
            OpenParen: "OpenParen",
            CloseParen: "CloseParen",
            OpenStatement: "OpenStatement",
            CloseStatement: "CloseStatement",
            OpenExpression: "OpenExpression",
            CloseExpression: "CloseExpression",
            OpenSquareBracket: "OpenSquareBracket",
            CloseSquareBracket: "CloseSquareBracket",
            OpenCurlyBracket: "OpenCurlyBracket",
            CloseCurlyBracket: "CloseCurlyBracket",
            Comma: "Comma",
            Dot: "Dot",
            Colon: "Colon",
            Pipe: "Pipe",
            CallOperator: "CallOperator",
            AdditiveBinaryOperator: "AdditiveBinaryOperator",
            MultiplicativeBinaryOperator: "MultiplicativeBinaryOperator",
            ComparisonBinaryOperator: "ComparisonBinaryOperator",
            UnaryOperator: "UnaryOperator",
            Comment: "Comment"
        })
          , h = class {
            constructor(n, B) {
                this.value = n,
                this.type = B
            }
        }
        ;
        function b(n) {
            return /\w/.test(n)
        }
        function R(n) {
            return /[0-9]/.test(n)
        }
        var C = [["{%", l.OpenStatement], ["%}", l.CloseStatement], ["{{", l.OpenExpression], ["}}", l.CloseExpression], ["(", l.OpenParen], [")", l.CloseParen], ["{", l.OpenCurlyBracket], ["}", l.CloseCurlyBracket], ["[", l.OpenSquareBracket], ["]", l.CloseSquareBracket], [",", l.Comma], [".", l.Dot], [":", l.Colon], ["|", l.Pipe], ["<=", l.ComparisonBinaryOperator], [">=", l.ComparisonBinaryOperator], ["==", l.ComparisonBinaryOperator], ["!=", l.ComparisonBinaryOperator], ["<", l.ComparisonBinaryOperator], [">", l.ComparisonBinaryOperator], ["+", l.AdditiveBinaryOperator], ["-", l.AdditiveBinaryOperator], ["~", l.AdditiveBinaryOperator], ["*", l.MultiplicativeBinaryOperator], ["/", l.MultiplicativeBinaryOperator], ["%", l.MultiplicativeBinaryOperator], ["=", l.Equals]]
          , M = new Map([["n", `
`], ["t", "	"], ["r", "\r"], ["b", "\b"], ["f", "\f"], ["v", "\v"], ["'", "'"], ['"', '"'], ["\\", "\\"]]);
        function f(n, B={}) {
            return n.endsWith(`
`) && (n = n.slice(0, -1)),
            B.lstrip_blocks && (n = n.replace(/^[ \t]*({[#%-])/gm, "$1")),
            B.trim_blocks && (n = n.replace(/([#%-]})\n/g, "$1")),
            n.replace(/-%}\s*/g, "%}").replace(/\s*{%-/g, "{%").replace(/-}}\s*/g, "}}").replace(/\s*{{-/g, "{{").replace(/-#}\s*/g, "#}").replace(/\s*{#-/g, "{#").replace(/{%\s*(end)?generation\s*%}/gs, "")
        }
        function L(n, B={}) {
            let w = []
              , O = f(n, B)
              , K = 0
              , ie = 0
              , fe = Ue => {
                let Qe = "";
                for (; Ue(O[K]); ) {
                    if (O[K] === "\\") {
                        if (++K,
                        K >= O.length)
                            throw new SyntaxError("Unexpected end of input");
                        let Oe = O[K++]
                          , lt = M.get(Oe);
                        if (lt === void 0)
                            throw new SyntaxError(`Unexpected escaped character: ${Oe}`);
                        Qe += lt;
                        continue
                    }
                    if (Qe += O[K++],
                    K >= O.length)
                        throw new SyntaxError("Unexpected end of input")
                }
                return Qe
            }
            ;
            e: for (; K < O.length; ) {
                let Ue = w.at(-1)?.type;
                if (Ue === void 0 || Ue === l.CloseStatement || Ue === l.CloseExpression || Ue === l.Comment) {
                    let Oe = "";
                    for (; K < O.length && !(O[K] === "{" && (O[K + 1] === "%" || O[K + 1] === "{" || O[K + 1] === "#")); )
                        Oe += O[K++];
                    if (Oe.length > 0) {
                        w.push(new h(Oe,l.Text));
                        continue
                    }
                }
                if (O[K] === "{" && O[K + 1] === "#") {
                    K += 2;
                    let Oe = "";
                    for (; O[K] !== "#" || O[K + 1] !== "}"; ) {
                        if (K + 2 >= O.length)
                            throw new SyntaxError("Missing end of comment tag");
                        Oe += O[K++]
                    }
                    w.push(new h(Oe,l.Comment)),
                    K += 2;
                    continue
                }
                fe(Oe => /\s/.test(Oe));
                let Qe = O[K];
                if (Qe === "-" || Qe === "+") {
                    let Oe = w.at(-1)?.type;
                    if (Oe === l.Text || Oe === void 0)
                        throw new SyntaxError(`Unexpected character: ${Qe}`);
                    switch (Oe) {
                    case l.Identifier:
                    case l.NumericLiteral:
                    case l.StringLiteral:
                    case l.CloseParen:
                    case l.CloseSquareBracket:
                        break;
                    default:
                        {
                            ++K;
                            let lt = fe(R);
                            w.push(new h(`${Qe}${lt}`,lt.length > 0 ? l.NumericLiteral : l.UnaryOperator));
                            continue
                        }
                    }
                }
                for (let[Oe,lt] of C) {
                    if (Oe === "}}" && ie > 0)
                        continue;
                    if (O.slice(K, K + Oe.length) === Oe) {
                        w.push(new h(Oe,lt)),
                        lt === l.OpenExpression ? ie = 0 : lt === l.OpenCurlyBracket ? ++ie : lt === l.CloseCurlyBracket && --ie,
                        K += Oe.length;
                        continue e
                    }
                }
                if (Qe === "'" || Qe === '"') {
                    ++K;
                    let Oe = fe(lt => lt !== Qe);
                    w.push(new h(Oe,l.StringLiteral)),
                    ++K;
                    continue
                }
                if (R(Qe)) {
                    let Oe = fe(R);
                    if (O[K] === "." && R(O[K + 1])) {
                        ++K;
                        let lt = fe(R);
                        Oe = `${Oe}.${lt}`
                    }
                    w.push(new h(Oe,l.NumericLiteral));
                    continue
                }
                if (b(Qe)) {
                    let Oe = fe(b);
                    w.push(new h(Oe,l.Identifier));
                    continue
                }
                throw new SyntaxError(`Unexpected character: ${Qe}`)
            }
            return w
        }
        var _ = class {
            type = "Statement"
        }
          , a = class extends _ {
            constructor(n) {
                super(),
                this.body = n
            }
            type = "Program"
        }
          , v = class extends _ {
            constructor(n, B, w) {
                super(),
                this.test = n,
                this.body = B,
                this.alternate = w
            }
            type = "If"
        }
          , g = class extends _ {
            constructor(n, B, w, O) {
                super(),
                this.loopvar = n,
                this.iterable = B,
                this.body = w,
                this.defaultBlock = O
            }
            type = "For"
        }
          , y = class extends _ {
            type = "Break"
        }
          , W = class extends _ {
            type = "Continue"
        }
          , T = class extends _ {
            constructor(n, B, w) {
                super(),
                this.assignee = n,
                this.value = B,
                this.body = w
            }
            type = "Set"
        }
          , k = class extends _ {
            constructor(n, B, w) {
                super(),
                this.name = n,
                this.args = B,
                this.body = w
            }
            type = "Macro"
        }
          , I = class extends _ {
            constructor(n) {
                super(),
                this.value = n
            }
            type = "Comment"
        }
          , p = class extends _ {
            type = "Expression"
        }
          , m = class extends p {
            constructor(n, B, w) {
                super(),
                this.object = n,
                this.property = B,
                this.computed = w
            }
            type = "MemberExpression"
        }
          , E = class extends p {
            constructor(n, B) {
                super(),
                this.callee = n,
                this.args = B
            }
            type = "CallExpression"
        }
          , o = class extends p {
            constructor(n) {
                super(),
                this.value = n
            }
            type = "Identifier"
        }
          , d = class extends p {
            constructor(n) {
                super(),
                this.value = n
            }
            type = "Literal"
        }
          , x = class extends d {
            type = "IntegerLiteral"
        }
          , S = class extends d {
            type = "FloatLiteral"
        }
          , N = class extends d {
            type = "StringLiteral"
        }
          , j = class extends d {
            type = "ArrayLiteral"
        }
          , D = class extends d {
            type = "TupleLiteral"
        }
          , $ = class extends d {
            type = "ObjectLiteral"
        }
          , U = class extends p {
            constructor(n, B, w) {
                super(),
                this.operator = n,
                this.left = B,
                this.right = w
            }
            type = "BinaryExpression"
        }
          , H = class extends p {
            constructor(n, B) {
                super(),
                this.operand = n,
                this.filter = B
            }
            type = "FilterExpression"
        }
          , Z = class extends _ {
            constructor(n, B) {
                super(),
                this.filter = n,
                this.body = B
            }
            type = "FilterStatement"
        }
          , ee = class extends p {
            constructor(n, B) {
                super(),
                this.lhs = n,
                this.test = B
            }
            type = "SelectExpression"
        }
          , le = class extends p {
            constructor(n, B, w) {
                super(),
                this.operand = n,
                this.negate = B,
                this.test = w
            }
            type = "TestExpression"
        }
          , we = class extends p {
            constructor(n, B) {
                super(),
                this.operator = n,
                this.argument = B
            }
            type = "UnaryExpression"
        }
          , ce = class extends p {
            constructor(n=void 0, B=void 0, w=void 0) {
                super(),
                this.start = n,
                this.stop = B,
                this.step = w
            }
            type = "SliceExpression"
        }
          , Q = class extends p {
            constructor(n, B) {
                super(),
                this.key = n,
                this.value = B
            }
            type = "KeywordArgumentExpression"
        }
          , A = class extends p {
            constructor(n) {
                super(),
                this.argument = n
            }
            type = "SpreadExpression"
        }
          , V = class extends _ {
            constructor(n, B, w) {
                super(),
                this.call = n,
                this.callerArgs = B,
                this.body = w
            }
            type = "CallStatement"
        }
          , J = class extends p {
            constructor(n, B, w) {
                super(),
                this.condition = n,
                this.trueExpr = B,
                this.falseExpr = w
            }
            type = "Ternary"
        }
        ;
        function ae(n) {
            let B = new a([])
              , w = 0;
            function O(Fe, ke) {
                let Ke = n[w++];
                if (!Ke || Ke.type !== Fe)
                    throw new Error(`Parser Error: ${ke}. ${Ke.type} !== ${Fe}.`);
                return Ke
            }
            function K(Fe) {
                if (!Qe(Fe))
                    throw new SyntaxError(`Expected ${Fe}`);
                ++w
            }
            function ie() {
                switch (n[w].type) {
                case l.Comment:
                    return new I(n[w++].value);
                case l.Text:
                    return Oe();
                case l.OpenStatement:
                    return lt();
                case l.OpenExpression:
                    return ct();
                default:
                    throw new SyntaxError(`Unexpected token type: ${n[w].type}`)
                }
            }
            function fe(...Fe) {
                return w + Fe.length <= n.length && Fe.every( (ke, Ke) => ke === n[w + Ke].type)
            }
            function Ue(...Fe) {
                return n[w]?.type === l.OpenStatement && n[w + 1]?.type === l.Identifier && Fe.includes(n[w + 1]?.value)
            }
            function Qe(...Fe) {
                return w + Fe.length <= n.length && Fe.every( (ke, Ke) => n[w + Ke].type === "Identifier" && ke === n[w + Ke].value)
            }
            function Oe() {
                return new N(O(l.Text, "Expected text token").value)
            }
            function lt() {
                if (O(l.OpenStatement, "Expected opening statement token"),
                n[w].type !== l.Identifier)
                    throw new SyntaxError(`Unknown statement, got ${n[w].type}`);
                let Fe = n[w].value, ke;
                switch (Fe) {
                case "set":
                    ++w,
                    ke = St();
                    break;
                case "if":
                    ++w,
                    ke = ft(),
                    O(l.OpenStatement, "Expected {% token"),
                    K("endif"),
                    O(l.CloseStatement, "Expected %} token");
                    break;
                case "macro":
                    ++w,
                    ke = es(),
                    O(l.OpenStatement, "Expected {% token"),
                    K("endmacro"),
                    O(l.CloseStatement, "Expected %} token");
                    break;
                case "for":
                    ++w,
                    ke = Jt(),
                    O(l.OpenStatement, "Expected {% token"),
                    K("endfor"),
                    O(l.CloseStatement, "Expected %} token");
                    break;
                case "call":
                    {
                        ++w;
                        let Ke = null;
                        fe(l.OpenParen) && (Ke = ps());
                        let wt = Yt();
                        if (wt.type !== "Identifier")
                            throw new SyntaxError("Expected identifier following call statement");
                        let Os = ps();
                        O(l.CloseStatement, "Expected closing statement token");
                        let Es = [];
                        for (; !Ue("endcall"); )
                            Es.push(ie());
                        O(l.OpenStatement, "Expected '{%'"),
                        K("endcall"),
                        O(l.CloseStatement, "Expected closing statement token");
                        let ns = new E(wt,Os);
                        ke = new V(ns,Ke,Es);
                        break
                    }
                case "break":
                    ++w,
                    O(l.CloseStatement, "Expected closing statement token"),
                    ke = new y;
                    break;
                case "continue":
                    ++w,
                    O(l.CloseStatement, "Expected closing statement token"),
                    ke = new W;
                    break;
                case "filter":
                    {
                        ++w;
                        let Ke = Yt();
                        Ke instanceof o && fe(l.OpenParen) && (Ke = us(Ke)),
                        O(l.CloseStatement, "Expected closing statement token");
                        let wt = [];
                        for (; !Ue("endfilter"); )
                            wt.push(ie());
                        O(l.OpenStatement, "Expected '{%'"),
                        K("endfilter"),
                        O(l.CloseStatement, "Expected '%}'"),
                        ke = new Z(Ke,wt);
                        break
                    }
                default:
                    throw new SyntaxError(`Unknown statement type: ${Fe}`)
                }
                return ke
            }
            function ct() {
                O(l.OpenExpression, "Expected opening expression token");
                let Fe = Bt();
                return O(l.CloseExpression, "Expected closing expression token"),
                Fe
            }
            function St() {
                let Fe = ss()
                  , ke = null
                  , Ke = [];
                if (fe(l.Equals))
                    ++w,
                    ke = ss();
                else {
                    for (O(l.CloseStatement, "Expected %} token"); !Ue("endset"); )
                        Ke.push(ie());
                    O(l.OpenStatement, "Expected {% token"),
                    K("endset")
                }
                return O(l.CloseStatement, "Expected closing statement token"),
                new T(Fe,ke,Ke)
            }
            function ft() {
                let Fe = Bt();
                O(l.CloseStatement, "Expected closing statement token");
                let ke = []
                  , Ke = [];
                for (; !Ue("elif", "else", "endif"); )
                    ke.push(ie());
                if (Ue("elif")) {
                    ++w,
                    ++w;
                    let wt = ft();
                    Ke.push(wt)
                } else if (Ue("else"))
                    for (++w,
                    ++w,
                    O(l.CloseStatement, "Expected closing statement token"); !Ue("endif"); )
                        Ke.push(ie());
                return new v(Fe,ke,Ke)
            }
            function es() {
                let Fe = Yt();
                if (Fe.type !== "Identifier")
                    throw new SyntaxError("Expected identifier following macro statement");
                let ke = ps();
                O(l.CloseStatement, "Expected closing statement token");
                let Ke = [];
                for (; !Ue("endmacro"); )
                    Ke.push(ie());
                return new k(Fe,ke,Ke)
            }
            function ss(Fe=!1) {
                let ke = Fe ? Yt : Bt
                  , Ke = [ke()]
                  , wt = fe(l.Comma);
                for (; wt && (++w,
                Ke.push(ke()),
                !!fe(l.Comma)); )
                    ;
                return wt ? new D(Ke) : Ke[0]
            }
            function Jt() {
                let Fe = ss(!0);
                if (!(Fe instanceof o || Fe instanceof D))
                    throw new SyntaxError(`Expected identifier/tuple for the loop variable, got ${Fe.type} instead`);
                if (!Qe("in"))
                    throw new SyntaxError("Expected `in` keyword following loop variable");
                ++w;
                let ke = Bt();
                O(l.CloseStatement, "Expected closing statement token");
                let Ke = [];
                for (; !Ue("endfor", "else"); )
                    Ke.push(ie());
                let wt = [];
                if (Ue("else"))
                    for (++w,
                    ++w,
                    O(l.CloseStatement, "Expected closing statement token"); !Ue("endfor"); )
                        wt.push(ie());
                return new g(Fe,ke,Ke,wt)
            }
            function Bt() {
                return rs()
            }
            function rs() {
                let Fe = Ps();
                if (Qe("if")) {
                    ++w;
                    let ke = Ps();
                    if (Qe("else")) {
                        ++w;
                        let Ke = rs();
                        return new J(ke,Fe,Ke)
                    } else
                        return new ee(Fe,ke)
                }
                return Fe
            }
            function Ps() {
                let Fe = Ts();
                for (; Qe("or"); ) {
                    let ke = n[w];
                    ++w;
                    let Ke = Ts();
                    Fe = new U(ke,Fe,Ke)
                }
                return Fe
            }
            function Ts() {
                let Fe = hs();
                for (; Qe("and"); ) {
                    let ke = n[w];
                    ++w;
                    let Ke = hs();
                    Fe = new U(ke,Fe,Ke)
                }
                return Fe
            }
            function hs() {
                let Fe;
                for (; Qe("not"); ) {
                    let ke = n[w];
                    ++w;
                    let Ke = hs();
                    Fe = new we(ke,Ke)
                }
                return Fe ?? ys()
            }
            function ys() {
                let Fe = ws();
                for (; ; ) {
                    let ke;
                    if (Qe("not", "in"))
                        ke = new h("not in",l.Identifier),
                        w += 2;
                    else if (Qe("in"))
                        ke = n[w++];
                    else if (fe(l.ComparisonBinaryOperator))
                        ke = n[w++];
                    else
                        break;
                    let Ke = ws();
                    Fe = new U(ke,Fe,Ke)
                }
                return Fe
            }
            function ws() {
                let Fe = as();
                for (; fe(l.AdditiveBinaryOperator); ) {
                    let ke = n[w];
                    ++w;
                    let Ke = as();
                    Fe = new U(ke,Fe,Ke)
                }
                return Fe
            }
            function os() {
                let Fe = xs(Yt());
                return fe(l.OpenParen) ? us(Fe) : Fe
            }
            function us(Fe) {
                let ke = new E(Fe,ps());
                return ke = xs(ke),
                fe(l.OpenParen) && (ke = us(ke)),
                ke
            }
            function ps() {
                O(l.OpenParen, "Expected opening parenthesis for arguments list");
                let Fe = Ds();
                return O(l.CloseParen, "Expected closing parenthesis for arguments list"),
                Fe
            }
            function Ds() {
                let Fe = [];
                for (; !fe(l.CloseParen); ) {
                    let ke;
                    if (n[w].type === l.MultiplicativeBinaryOperator && n[w].value === "*") {
                        ++w;
                        let Ke = Bt();
                        ke = new A(Ke)
                    } else if (ke = Bt(),
                    fe(l.Equals)) {
                        if (++w,
                        !(ke instanceof o))
                            throw new SyntaxError("Expected identifier for keyword argument");
                        let Ke = Bt();
                        ke = new Q(ke,Ke)
                    }
                    Fe.push(ke),
                    fe(l.Comma) && ++w
                }
                return Fe
            }
            function bs() {
                let Fe = []
                  , ke = !1;
                for (; !fe(l.CloseSquareBracket); )
                    fe(l.Colon) ? (Fe.push(void 0),
                    ++w,
                    ke = !0) : (Fe.push(Bt()),
                    fe(l.Colon) && (++w,
                    ke = !0));
                if (Fe.length === 0)
                    throw new SyntaxError("Expected at least one argument for member/slice expression");
                if (ke) {
                    if (Fe.length > 3)
                        throw new SyntaxError("Expected 0-3 arguments for slice expression");
                    return new ce(...Fe)
                }
                return Fe[0]
            }
            function xs(Fe) {
                for (; fe(l.Dot) || fe(l.OpenSquareBracket); ) {
                    let ke = n[w];
                    ++w;
                    let Ke, wt = ke.type === l.OpenSquareBracket;
                    if (wt)
                        Ke = bs(),
                        O(l.CloseSquareBracket, "Expected closing square bracket");
                    else if (Ke = Yt(),
                    Ke.type !== "Identifier")
                        throw new SyntaxError("Expected identifier following dot operator");
                    Fe = new m(Fe,Ke,wt)
                }
                return Fe
            }
            function as() {
                let Fe = vs();
                for (; fe(l.MultiplicativeBinaryOperator); ) {
                    let ke = n[w++]
                      , Ke = vs();
                    Fe = new U(ke,Fe,Ke)
                }
                return Fe
            }
            function vs() {
                let Fe = Is();
                for (; Qe("is"); ) {
                    ++w;
                    let ke = Qe("not");
                    ke && ++w;
                    let Ke = Yt();
                    if (!(Ke instanceof o))
                        throw new SyntaxError("Expected identifier for the test");
                    Fe = new le(Fe,ke,Ke)
                }
                return Fe
            }
            function Is() {
                let Fe = os();
                for (; fe(l.Pipe); ) {
                    ++w;
                    let ke = Yt();
                    if (!(ke instanceof o))
                        throw new SyntaxError("Expected identifier for the filter");
                    fe(l.OpenParen) && (ke = us(ke)),
                    Fe = new H(Fe,ke)
                }
                return Fe
            }
            function Yt() {
                let Fe = n[w++];
                switch (Fe.type) {
                case l.NumericLiteral:
                    {
                        let ke = Fe.value;
                        return ke.includes(".") ? new S(Number(ke)) : new x(Number(ke))
                    }
                case l.StringLiteral:
                    {
                        let ke = Fe.value;
                        for (; fe(l.StringLiteral); )
                            ke += n[w++].value;
                        return new N(ke)
                    }
                case l.Identifier:
                    return new o(Fe.value);
                case l.OpenParen:
                    {
                        let ke = ss();
                        return O(l.CloseParen, "Expected closing parenthesis, got ${tokens[current].type} instead."),
                        ke
                    }
                case l.OpenSquareBracket:
                    {
                        let ke = [];
                        for (; !fe(l.CloseSquareBracket); )
                            ke.push(Bt()),
                            fe(l.Comma) && ++w;
                        return ++w,
                        new j(ke)
                    }
                case l.OpenCurlyBracket:
                    {
                        let ke = new Map;
                        for (; !fe(l.CloseCurlyBracket); ) {
                            let Ke = Bt();
                            O(l.Colon, "Expected colon between key and value in object literal");
                            let wt = Bt();
                            ke.set(Ke, wt),
                            fe(l.Comma) && ++w
                        }
                        return ++w,
                        new $(ke)
                    }
                default:
                    throw new SyntaxError(`Unexpected token: ${Fe.type}`)
                }
            }
            for (; w < n.length; )
                B.body.push(ie());
            return B
        }
        function xe(n, B, w=1) {
            B === void 0 && (B = n,
            n = 0);
            let O = [];
            for (let K = n; K < B; K += w)
                O.push(K);
            return O
        }
        function be(n, B, w, O=1) {
            let K = Math.sign(O);
            K >= 0 ? (B = (B ??= 0) < 0 ? Math.max(n.length + B, 0) : Math.min(B, n.length),
            w = (w ??= n.length) < 0 ? Math.max(n.length + w, 0) : Math.min(w, n.length)) : (B = (B ??= n.length - 1) < 0 ? Math.max(n.length + B, -1) : Math.min(B, n.length - 1),
            w = (w ??= -1) < -1 ? Math.max(n.length + w, -1) : Math.min(w, n.length - 1));
            let ie = [];
            for (let fe = B; K * fe < K * w; fe += O)
                ie.push(n[fe]);
            return ie
        }
        function Ae(n) {
            return n.replace(/\b\w/g, B => B.toUpperCase())
        }
        function We(n) {
            return he(new Date, n)
        }
        function he(n, B) {
            let w = new Intl.DateTimeFormat(void 0,{
                month: "long"
            })
              , O = new Intl.DateTimeFormat(void 0,{
                month: "short"
            })
              , K = ie => ie < 10 ? "0" + ie : ie.toString();
            return B.replace(/%[YmdbBHM%]/g, ie => {
                switch (ie) {
                case "%Y":
                    return n.getFullYear().toString();
                case "%m":
                    return K(n.getMonth() + 1);
                case "%d":
                    return K(n.getDate());
                case "%b":
                    return O.format(n);
                case "%B":
                    return w.format(n);
                case "%H":
                    return K(n.getHours());
                case "%M":
                    return K(n.getMinutes());
                case "%%":
                    return "%";
                default:
                    return ie
                }
            }
            )
        }
        function c(n) {
            return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }
        function Y(n, B, w, O) {
            if (O === 0)
                return n;
            let K = O == null || O < 0 ? 1 / 0 : O
              , ie = B.length === 0 ? new RegExp("(?=)","gu") : new RegExp(c(B),"gu");
            return n.replaceAll(ie, fe => K > 0 ? (--K,
            w) : fe)
        }
        var _e = class extends Error {
        }
          , ue = class extends Error {
        }
          , Me = class {
            type = "RuntimeValue";
            value;
            builtins = new Map;
            constructor(n=void 0) {
                this.value = n
            }
            __bool__() {
                return new Te(!!this.value)
            }
            toString() {
                return String(this.value)
            }
        }
          , re = class extends Me {
            type = "IntegerValue"
        }
          , pe = class extends Me {
            type = "FloatValue";
            toString() {
                return this.value % 1 === 0 ? this.value.toFixed(1) : this.value.toString()
            }
        }
          , se = class extends Me {
            type = "StringValue";
            builtins = new Map([["upper", new De( () => new se(this.value.toUpperCase()))], ["lower", new De( () => new se(this.value.toLowerCase()))], ["strip", new De( () => new se(this.value.trim()))], ["title", new De( () => new se(Ae(this.value)))], ["capitalize", new De( () => new se(this.value.charAt(0).toUpperCase() + this.value.slice(1)))], ["length", new re(this.value.length)], ["rstrip", new De( () => new se(this.value.trimEnd()))], ["lstrip", new De( () => new se(this.value.trimStart()))], ["startswith", new De(n => {
                if (n.length === 0)
                    throw new Error("startswith() requires at least one argument");
                let B = n[0];
                if (B instanceof se)
                    return new Te(this.value.startsWith(B.value));
                if (B instanceof Pe) {
                    for (let w of B.value) {
                        if (!(w instanceof se))
                            throw new Error("startswith() tuple elements must be strings");
                        if (this.value.startsWith(w.value))
                            return new Te(!0)
                    }
                    return new Te(!1)
                }
                throw new Error("startswith() argument must be a string or tuple of strings")
            }
            )], ["endswith", new De(n => {
                if (n.length === 0)
                    throw new Error("endswith() requires at least one argument");
                let B = n[0];
                if (B instanceof se)
                    return new Te(this.value.endsWith(B.value));
                if (B instanceof Pe) {
                    for (let w of B.value) {
                        if (!(w instanceof se))
                            throw new Error("endswith() tuple elements must be strings");
                        if (this.value.endsWith(w.value))
                            return new Te(!0)
                    }
                    return new Te(!1)
                }
                throw new Error("endswith() argument must be a string or tuple of strings")
            }
            )], ["split", new De(n => {
                let B = n[0] ?? new Ve;
                if (!(B instanceof se || B instanceof Ve))
                    throw new Error("sep argument must be a string or null");
                let w = n[1] ?? new re(-1);
                if (!(w instanceof re))
                    throw new Error("maxsplit argument must be a number");
                let O = [];
                if (B instanceof Ve) {
                    let K = this.value.trimStart();
                    for (let {0: ie, index: fe} of K.matchAll(/\S+/g)) {
                        if (w.value !== -1 && O.length >= w.value && fe !== void 0) {
                            O.push(ie + K.slice(fe + ie.length));
                            break
                        }
                        O.push(ie)
                    }
                } else {
                    if (B.value === "")
                        throw new Error("empty separator");
                    O = this.value.split(B.value),
                    w.value !== -1 && O.length > w.value && O.push(O.splice(w.value).join(B.value))
                }
                return new Pe(O.map(K => new se(K)))
            }
            )], ["replace", new De(n => {
                if (n.length < 2)
                    throw new Error("replace() requires at least two arguments");
                let B = n[0]
                  , w = n[1];
                if (!(B instanceof se && w instanceof se))
                    throw new Error("replace() arguments must be strings");
                let O;
                if (n.length > 2 ? n[2].type === "KeywordArgumentsValue" ? O = n[2].value.get("count") ?? new Ve : O = n[2] : O = new Ve,
                !(O instanceof re || O instanceof Ve))
                    throw new Error("replace() count argument must be a number or null");
                return new se(Y(this.value, B.value, w.value, O.value))
            }
            )]])
        }
          , Te = class extends Me {
            type = "BooleanValue"
        }
          , Ee = class extends Me {
            type = "ObjectValue";
            __bool__() {
                return new Te(this.value.size > 0)
            }
            builtins = new Map([["get", new De( ([n,B]) => {
                if (!(n instanceof se))
                    throw new Error(`Object key must be a string: got ${n.type}`);
                return this.value.get(n.value) ?? B ?? new Ve
            }
            )], ["items", new De( () => this.items())], ["keys", new De( () => this.keys())], ["values", new De( () => this.values())]]);
            items() {
                return new Pe(Array.from(this.value.entries()).map( ([n,B]) => new Pe([new se(n), B])))
            }
            keys() {
                return new Pe(Array.from(this.value.keys()).map(n => new se(n)))
            }
            values() {
                return new Pe(Array.from(this.value.values()))
            }
        }
          , ye = class extends Ee {
            type = "KeywordArgumentsValue"
        }
          , Pe = class extends Me {
            type = "ArrayValue";
            builtins = new Map([["length", new re(this.value.length)]]);
            __bool__() {
                return new Te(this.value.length > 0)
            }
        }
          , Se = class extends Pe {
            type = "TupleValue"
        }
          , De = class extends Me {
            type = "FunctionValue"
        }
          , Ve = class extends Me {
            type = "NullValue"
        }
          , Re = class extends Me {
            type = "UndefinedValue"
        }
          , $e = class {
            constructor(n) {
                this.parent = n
            }
            variables = new Map([["namespace", new De(n => {
                if (n.length === 0)
                    return new Ee(new Map);
                if (n.length !== 1 || !(n[0]instanceof Ee))
                    throw new Error("`namespace` expects either zero arguments or a single object argument");
                return n[0]
            }
            )]]);
            tests = new Map([["boolean", n => n.type === "BooleanValue"], ["callable", n => n instanceof De], ["odd", n => {
                if (!(n instanceof re))
                    throw new Error(`cannot odd on ${n.type}`);
                return n.value % 2 !== 0
            }
            ], ["even", n => {
                if (!(n instanceof re))
                    throw new Error(`cannot even on ${n.type}`);
                return n.value % 2 === 0
            }
            ], ["false", n => n.type === "BooleanValue" && !n.value], ["true", n => n.type === "BooleanValue" && n.value], ["none", n => n.type === "NullValue"], ["string", n => n.type === "StringValue"], ["number", n => n instanceof re || n instanceof pe], ["integer", n => n instanceof re], ["iterable", n => n.type === "ArrayValue" || n.type === "StringValue"], ["mapping", n => n.type === "ObjectValue"], ["lower", n => {
                let B = n.value;
                return n.type === "StringValue" && B === B.toLowerCase()
            }
            ], ["upper", n => {
                let B = n.value;
                return n.type === "StringValue" && B === B.toUpperCase()
            }
            ], ["none", n => n.type === "NullValue"], ["defined", n => n.type !== "UndefinedValue"], ["undefined", n => n.type === "UndefinedValue"], ["equalto", (n, B) => n.value === B.value], ["eq", (n, B) => n.value === B.value]]);
            set(n, B) {
                return this.declareVariable(n, Ie(B))
            }
            declareVariable(n, B) {
                if (this.variables.has(n))
                    throw new SyntaxError(`Variable already declared: ${n}`);
                return this.variables.set(n, B),
                B
            }
            setVariable(n, B) {
                return this.variables.set(n, B),
                B
            }
            resolve(n) {
                if (this.variables.has(n))
                    return this;
                if (this.parent)
                    return this.parent.resolve(n);
                throw new Error(`Unknown variable: ${n}`)
            }
            lookupVariable(n) {
                try {
                    return this.resolve(n).variables.get(n) ?? new Re
                } catch {
                    return new Re
                }
            }
        }
        ;
        function ze(n) {
            n.set("false", !1),
            n.set("true", !0),
            n.set("none", null),
            n.set("raise_exception", B => {
                throw new Error(B)
            }
            ),
            n.set("range", xe),
            n.set("strftime_now", We),
            n.set("True", !0),
            n.set("False", !1),
            n.set("None", null)
        }
        var Ze = class {
            global;
            constructor(n) {
                this.global = n ?? new $e
            }
            run(n) {
                return this.evaluate(n, this.global)
            }
            evaluateBinaryExpression(n, B) {
                let w = this.evaluate(n.left, B);
                switch (n.operator.value) {
                case "and":
                    return w.__bool__().value ? this.evaluate(n.right, B) : w;
                case "or":
                    return w.__bool__().value ? w : this.evaluate(n.right, B)
                }
                let O = this.evaluate(n.right, B);
                switch (n.operator.value) {
                case "==":
                    return new Te(w.value == O.value);
                case "!=":
                    return new Te(w.value != O.value)
                }
                if (w instanceof Re || O instanceof Re) {
                    if (O instanceof Re && ["in", "not in"].includes(n.operator.value))
                        return new Te(n.operator.value === "not in");
                    throw new Error(`Cannot perform operation ${n.operator.value} on undefined values`)
                } else {
                    if (w instanceof Ve || O instanceof Ve)
                        throw new Error("Cannot perform operation on null values");
                    if (n.operator.value === "~")
                        return new se(w.value.toString() + O.value.toString());
                    if ((w instanceof re || w instanceof pe) && (O instanceof re || O instanceof pe)) {
                        let K = w.value
                          , ie = O.value;
                        switch (n.operator.value) {
                        case "+":
                        case "-":
                        case "*":
                            {
                                let fe = n.operator.value === "+" ? K + ie : n.operator.value === "-" ? K - ie : K * ie;
                                return w instanceof pe || O instanceof pe ? new pe(fe) : new re(fe)
                            }
                        case "/":
                            return new pe(K / ie);
                        case "%":
                            {
                                let fe = K % ie;
                                return w instanceof pe || O instanceof pe ? new pe(fe) : new re(fe)
                            }
                        case "<":
                            return new Te(K < ie);
                        case ">":
                            return new Te(K > ie);
                        case ">=":
                            return new Te(K >= ie);
                        case "<=":
                            return new Te(K <= ie)
                        }
                    } else if (w instanceof Pe && O instanceof Pe)
                        switch (n.operator.value) {
                        case "+":
                            return new Pe(w.value.concat(O.value))
                        }
                    else if (O instanceof Pe) {
                        let K = O.value.find(ie => ie.value === w.value) !== void 0;
                        switch (n.operator.value) {
                        case "in":
                            return new Te(K);
                        case "not in":
                            return new Te(!K)
                        }
                    }
                }
                if (w instanceof se || O instanceof se)
                    switch (n.operator.value) {
                    case "+":
                        return new se(w.value.toString() + O.value.toString())
                    }
                if (w instanceof se && O instanceof se)
                    switch (n.operator.value) {
                    case "in":
                        return new Te(O.value.includes(w.value));
                    case "not in":
                        return new Te(!O.value.includes(w.value))
                    }
                if (w instanceof se && O instanceof Ee)
                    switch (n.operator.value) {
                    case "in":
                        return new Te(O.value.has(w.value));
                    case "not in":
                        return new Te(!O.value.has(w.value))
                    }
                throw new SyntaxError(`Unknown operator "${n.operator.value}" between ${w.type} and ${O.type}`)
            }
            evaluateArguments(n, B) {
                let w = []
                  , O = new Map;
                for (let K of n)
                    if (K.type === "SpreadExpression") {
                        let ie = K
                          , fe = this.evaluate(ie.argument, B);
                        if (!(fe instanceof Pe))
                            throw new Error(`Cannot unpack non-iterable type: ${fe.type}`);
                        for (let Ue of fe.value)
                            w.push(Ue)
                    } else if (K.type === "KeywordArgumentExpression") {
                        let ie = K;
                        O.set(ie.key.value, this.evaluate(ie.value, B))
                    } else {
                        if (O.size > 0)
                            throw new Error("Positional arguments must come before keyword arguments");
                        w.push(this.evaluate(K, B))
                    }
                return [w, O]
            }
            applyFilter(n, B, w) {
                if (B.type === "Identifier") {
                    let O = B;
                    if (O.value === "tojson")
                        return new se(st(n));
                    if (n instanceof Pe)
                        switch (O.value) {
                        case "list":
                            return n;
                        case "first":
                            return n.value[0];
                        case "last":
                            return n.value[n.value.length - 1];
                        case "length":
                            return new re(n.value.length);
                        case "reverse":
                            return new Pe(n.value.reverse());
                        case "sort":
                            return new Pe(n.value.sort( (K, ie) => {
                                if (K.type !== ie.type)
                                    throw new Error(`Cannot compare different types: ${K.type} and ${ie.type}`);
                                switch (K.type) {
                                case "IntegerValue":
                                case "FloatValue":
                                    return K.value - ie.value;
                                case "StringValue":
                                    return K.value.localeCompare(ie.value);
                                default:
                                    throw new Error(`Cannot compare type: ${K.type}`)
                                }
                            }
                            ));
                        case "join":
                            return new se(n.value.map(K => K.value).join(""));
                        case "string":
                            return new se(st(n));
                        case "unique":
                            {
                                let K = new Set
                                  , ie = [];
                                for (let fe of n.value)
                                    K.has(fe.value) || (K.add(fe.value),
                                    ie.push(fe));
                                return new Pe(ie)
                            }
                        default:
                            throw new Error(`Unknown ArrayValue filter: ${O.value}`)
                        }
                    else if (n instanceof se)
                        switch (O.value) {
                        case "length":
                        case "upper":
                        case "lower":
                        case "title":
                        case "capitalize":
                            {
                                let K = n.builtins.get(O.value);
                                if (K instanceof De)
                                    return K.value([], w);
                                if (K instanceof re)
                                    return K;
                                throw new Error(`Unknown StringValue filter: ${O.value}`)
                            }
                        case "trim":
                            return new se(n.value.trim());
                        case "indent":
                            return new se(n.value.split(`
`).map( (K, ie) => ie === 0 || K.length === 0 ? K : "    " + K).join(`
`));
                        case "join":
                        case "string":
                            return n;
                        case "int":
                            {
                                let K = parseInt(n.value, 10);
                                return new re(isNaN(K) ? 0 : K)
                            }
                        case "float":
                            {
                                let K = parseFloat(n.value);
                                return new pe(isNaN(K) ? 0 : K)
                            }
                        default:
                            throw new Error(`Unknown StringValue filter: ${O.value}`)
                        }
                    else if (n instanceof re || n instanceof pe)
                        switch (O.value) {
                        case "abs":
                            return n instanceof re ? new re(Math.abs(n.value)) : new pe(Math.abs(n.value));
                        case "int":
                            return new re(Math.floor(n.value));
                        case "float":
                            return new pe(n.value);
                        default:
                            throw new Error(`Unknown NumericValue filter: ${O.value}`)
                        }
                    else if (n instanceof Ee)
                        switch (O.value) {
                        case "items":
                            return new Pe(Array.from(n.value.entries()).map( ([K,ie]) => new Pe([new se(K), ie])));
                        case "length":
                            return new re(n.value.size);
                        default:
                            throw new Error(`Unknown ObjectValue filter: ${O.value}`)
                        }
                    else if (n instanceof Te)
                        switch (O.value) {
                        case "bool":
                            return new Te(n.value);
                        case "int":
                            return new re(n.value ? 1 : 0);
                        case "float":
                            return new pe(n.value ? 1 : 0);
                        case "string":
                            return new se(n.value ? "true" : "false");
                        default:
                            throw new Error(`Unknown BooleanValue filter: ${O.value}`)
                        }
                    throw new Error(`Cannot apply filter "${O.value}" to type: ${n.type}`)
                } else if (B.type === "CallExpression") {
                    let O = B;
                    if (O.callee.type !== "Identifier")
                        throw new Error(`Unknown filter: ${O.callee.type}`);
                    let K = O.callee.value;
                    if (K === "tojson") {
                        let[,ie] = this.evaluateArguments(O.args, w)
                          , fe = ie.get("indent") ?? new Ve;
                        if (!(fe instanceof re || fe instanceof Ve))
                            throw new Error("If set, indent must be a number");
                        return new se(st(n, fe.value))
                    } else if (K === "join") {
                        let ie;
                        if (n instanceof se)
                            ie = Array.from(n.value);
                        else if (n instanceof Pe)
                            ie = n.value.map(Oe => Oe.value);
                        else
                            throw new Error(`Cannot apply filter "${K}" to type: ${n.type}`);
                        let[fe,Ue] = this.evaluateArguments(O.args, w)
                          , Qe = fe.at(0) ?? Ue.get("separator") ?? new se("");
                        if (!(Qe instanceof se))
                            throw new Error("separator must be a string");
                        return new se(ie.join(Qe.value))
                    } else if (K === "int" || K === "float") {
                        let[ie,fe] = this.evaluateArguments(O.args, w)
                          , Ue = ie.at(0) ?? fe.get("default") ?? (K === "int" ? new re(0) : new pe(0));
                        if (n instanceof se) {
                            let Qe = K === "int" ? parseInt(n.value, 10) : parseFloat(n.value);
                            return isNaN(Qe) ? Ue : K === "int" ? new re(Qe) : new pe(Qe)
                        } else {
                            if (n instanceof re || n instanceof pe)
                                return n;
                            if (n instanceof Te)
                                return K === "int" ? new re(n.value ? 1 : 0) : new pe(n.value ? 1 : 0);
                            throw new Error(`Cannot apply filter "${K}" to type: ${n.type}`)
                        }
                    } else if (K === "default") {
                        let[ie,fe] = this.evaluateArguments(O.args, w)
                          , Ue = ie[0] ?? new se("")
                          , Qe = ie[1] ?? fe.get("boolean") ?? new Te(!1);
                        if (!(Qe instanceof Te))
                            throw new Error("`default` filter flag must be a boolean");
                        return n instanceof Re || Qe.value && !n.__bool__().value ? Ue : n
                    }
                    if (n instanceof Pe) {
                        switch (K) {
                        case "selectattr":
                        case "rejectattr":
                            {
                                let ie = K === "selectattr";
                                if (n.value.some(ct => !(ct instanceof Ee)))
                                    throw new Error(`\`${K}\` can only be applied to array of objects`);
                                if (O.args.some(ct => ct.type !== "StringLiteral"))
                                    throw new Error(`arguments of \`${K}\` must be strings`);
                                let[fe,Ue,Qe] = O.args.map(ct => this.evaluate(ct, w)), Oe;
                                if (Ue) {
                                    let ct = w.tests.get(Ue.value);
                                    if (!ct)
                                        throw new Error(`Unknown test: ${Ue.value}`);
                                    Oe = ct
                                } else
                                    Oe = (...ct) => ct[0].__bool__().value;
                                let lt = n.value.filter(ct => {
                                    let St = ct.value.get(fe.value)
                                      , ft = St ? Oe(St, Qe) : !1;
                                    return ie ? ft : !ft
                                }
                                );
                                return new Pe(lt)
                            }
                        case "map":
                            {
                                let[,ie] = this.evaluateArguments(O.args, w);
                                if (ie.has("attribute")) {
                                    let fe = ie.get("attribute");
                                    if (!(fe instanceof se))
                                        throw new Error("attribute must be a string");
                                    let Ue = ie.get("default")
                                      , Qe = n.value.map(Oe => {
                                        if (!(Oe instanceof Ee))
                                            throw new Error("items in map must be an object");
                                        return Oe.value.get(fe.value) ?? Ue ?? new Re
                                    }
                                    );
                                    return new Pe(Qe)
                                } else
                                    throw new Error("`map` expressions without `attribute` set are not currently supported.")
                            }
                        }
                        throw new Error(`Unknown ArrayValue filter: ${K}`)
                    } else if (n instanceof se) {
                        switch (K) {
                        case "indent":
                            {
                                let[ie,fe] = this.evaluateArguments(O.args, w)
                                  , Ue = ie.at(0) ?? fe.get("width") ?? new re(4);
                                if (!(Ue instanceof re))
                                    throw new Error("width must be a number");
                                let Qe = ie.at(1) ?? fe.get("first") ?? new Te(!1)
                                  , Oe = ie.at(2) ?? fe.get("blank") ?? new Te(!1)
                                  , lt = n.value.split(`
`)
                                  , ct = " ".repeat(Ue.value)
                                  , St = lt.map( (ft, es) => !Qe.value && es === 0 || !Oe.value && ft.length === 0 ? ft : ct + ft);
                                return new se(St.join(`
`))
                            }
                        case "replace":
                            {
                                let ie = n.builtins.get("replace");
                                if (!(ie instanceof De))
                                    throw new Error("replace filter not available");
                                let[fe,Ue] = this.evaluateArguments(O.args, w);
                                return ie.value([...fe, new ye(Ue)], w)
                            }
                        }
                        throw new Error(`Unknown StringValue filter: ${K}`)
                    } else
                        throw new Error(`Cannot apply filter "${K}" to type: ${n.type}`)
                }
                throw new Error(`Unknown filter: ${B.type}`)
            }
            evaluateFilterExpression(n, B) {
                let w = this.evaluate(n.operand, B);
                return this.applyFilter(w, n.filter, B)
            }
            evaluateTestExpression(n, B) {
                let w = this.evaluate(n.operand, B)
                  , O = B.tests.get(n.test.value);
                if (!O)
                    throw new Error(`Unknown test: ${n.test.value}`);
                let K = O(w);
                return new Te(n.negate ? !K : K)
            }
            evaluateSelectExpression(n, B) {
                return this.evaluate(n.test, B).__bool__().value ? this.evaluate(n.lhs, B) : new Re
            }
            evaluateUnaryExpression(n, B) {
                let w = this.evaluate(n.argument, B);
                switch (n.operator.value) {
                case "not":
                    return new Te(!w.value);
                default:
                    throw new SyntaxError(`Unknown operator: ${n.operator.value}`)
                }
            }
            evaluateTernaryExpression(n, B) {
                return this.evaluate(n.condition, B).__bool__().value ? this.evaluate(n.trueExpr, B) : this.evaluate(n.falseExpr, B)
            }
            evalProgram(n, B) {
                return this.evaluateBlock(n.body, B)
            }
            evaluateBlock(n, B) {
                let w = "";
                for (let O of n) {
                    let K = this.evaluate(O, B);
                    K.type !== "NullValue" && K.type !== "UndefinedValue" && (w += K.toString())
                }
                return new se(w)
            }
            evaluateIdentifier(n, B) {
                return B.lookupVariable(n.value)
            }
            evaluateCallExpression(n, B) {
                let[w,O] = this.evaluateArguments(n.args, B);
                O.size > 0 && w.push(new ye(O));
                let K = this.evaluate(n.callee, B);
                if (K.type !== "FunctionValue")
                    throw new Error(`Cannot call something that is not a function: got ${K.type}`);
                return K.value(w, B)
            }
            evaluateSliceExpression(n, B, w) {
                if (!(n instanceof Pe || n instanceof se))
                    throw new Error("Slice object must be an array or string");
                let O = this.evaluate(B.start, w)
                  , K = this.evaluate(B.stop, w)
                  , ie = this.evaluate(B.step, w);
                if (!(O instanceof re || O instanceof Re))
                    throw new Error("Slice start must be numeric or undefined");
                if (!(K instanceof re || K instanceof Re))
                    throw new Error("Slice stop must be numeric or undefined");
                if (!(ie instanceof re || ie instanceof Re))
                    throw new Error("Slice step must be numeric or undefined");
                return n instanceof Pe ? new Pe(be(n.value, O.value, K.value, ie.value)) : new se(be(Array.from(n.value), O.value, K.value, ie.value).join(""))
            }
            evaluateMemberExpression(n, B) {
                let w = this.evaluate(n.object, B), O;
                if (n.computed) {
                    if (n.property.type === "SliceExpression")
                        return this.evaluateSliceExpression(w, n.property, B);
                    O = this.evaluate(n.property, B)
                } else
                    O = new se(n.property.value);
                let K;
                if (w instanceof Ee) {
                    if (!(O instanceof se))
                        throw new Error(`Cannot access property with non-string: got ${O.type}`);
                    K = w.value.get(O.value) ?? w.builtins.get(O.value)
                } else if (w instanceof Pe || w instanceof se)
                    if (O instanceof re)
                        K = w.value.at(O.value),
                        w instanceof se && (K = new se(w.value.at(O.value)));
                    else if (O instanceof se)
                        K = w.builtins.get(O.value);
                    else
                        throw new Error(`Cannot access property with non-string/non-number: got ${O.type}`);
                else {
                    if (!(O instanceof se))
                        throw new Error(`Cannot access property with non-string: got ${O.type}`);
                    K = w.builtins.get(O.value)
                }
                return K instanceof Me ? K : new Re
            }
            evaluateSet(n, B) {
                let w = n.value ? this.evaluate(n.value, B) : this.evaluateBlock(n.body, B);
                if (n.assignee.type === "Identifier") {
                    let O = n.assignee.value;
                    B.setVariable(O, w)
                } else if (n.assignee.type === "TupleLiteral") {
                    let O = n.assignee;
                    if (!(w instanceof Pe))
                        throw new Error(`Cannot unpack non-iterable type in set: ${w.type}`);
                    let K = w.value;
                    if (K.length !== O.value.length)
                        throw new Error(`Too ${O.value.length > K.length ? "few" : "many"} items to unpack in set`);
                    for (let ie = 0; ie < O.value.length; ++ie) {
                        let fe = O.value[ie];
                        if (fe.type !== "Identifier")
                            throw new Error(`Cannot unpack to non-identifier in set: ${fe.type}`);
                        B.setVariable(fe.value, K[ie])
                    }
                } else if (n.assignee.type === "MemberExpression") {
                    let O = n.assignee
                      , K = this.evaluate(O.object, B);
                    if (!(K instanceof Ee))
                        throw new Error("Cannot assign to member of non-object");
                    if (O.property.type !== "Identifier")
                        throw new Error("Cannot assign to member with non-identifier property");
                    K.value.set(O.property.value, w)
                } else
                    throw new Error(`Invalid LHS inside assignment expression: ${JSON.stringify(n.assignee)}`);
                return new Ve
            }
            evaluateIf(n, B) {
                let w = this.evaluate(n.test, B);
                return this.evaluateBlock(w.__bool__().value ? n.body : n.alternate, B)
            }
            evaluateFor(n, B) {
                let w = new $e(B), O, K;
                if (n.iterable.type === "SelectExpression") {
                    let Oe = n.iterable;
                    K = this.evaluate(Oe.lhs, w),
                    O = Oe.test
                } else
                    K = this.evaluate(n.iterable, w);
                if (!(K instanceof Pe || K instanceof Ee))
                    throw new Error(`Expected iterable or object type in for loop: got ${K.type}`);
                K instanceof Ee && (K = K.keys());
                let ie = []
                  , fe = [];
                for (let Oe = 0; Oe < K.value.length; ++Oe) {
                    let lt = new $e(w), ct = K.value[Oe], St;
                    if (n.loopvar.type === "Identifier")
                        St = ft => ft.setVariable(n.loopvar.value, ct);
                    else if (n.loopvar.type === "TupleLiteral") {
                        let ft = n.loopvar;
                        if (ct.type !== "ArrayValue")
                            throw new Error(`Cannot unpack non-iterable type: ${ct.type}`);
                        let es = ct;
                        if (ft.value.length !== es.value.length)
                            throw new Error(`Too ${ft.value.length > es.value.length ? "few" : "many"} items to unpack`);
                        St = ss => {
                            for (let Jt = 0; Jt < ft.value.length; ++Jt) {
                                if (ft.value[Jt].type !== "Identifier")
                                    throw new Error(`Cannot unpack non-identifier type: ${ft.value[Jt].type}`);
                                ss.setVariable(ft.value[Jt].value, es.value[Jt])
                            }
                        }
                    } else
                        throw new Error(`Invalid loop variable(s): ${n.loopvar.type}`);
                    O && (St(lt),
                    !this.evaluate(O, lt).__bool__().value) || (ie.push(ct),
                    fe.push(St))
                }
                let Ue = ""
                  , Qe = !0;
                for (let Oe = 0; Oe < ie.length; ++Oe) {
                    let lt = new Map([["index", new re(Oe + 1)], ["index0", new re(Oe)], ["revindex", new re(ie.length - Oe)], ["revindex0", new re(ie.length - Oe - 1)], ["first", new Te(Oe === 0)], ["last", new Te(Oe === ie.length - 1)], ["length", new re(ie.length)], ["previtem", Oe > 0 ? ie[Oe - 1] : new Re], ["nextitem", Oe < ie.length - 1 ? ie[Oe + 1] : new Re]]);
                    w.setVariable("loop", new Ee(lt)),
                    fe[Oe](w);
                    try {
                        let ct = this.evaluateBlock(n.body, w);
                        Ue += ct.value
                    } catch (ct) {
                        if (ct instanceof ue)
                            continue;
                        if (ct instanceof _e)
                            break;
                        throw ct
                    }
                    Qe = !1
                }
                if (Qe) {
                    let Oe = this.evaluateBlock(n.defaultBlock, w);
                    Ue += Oe.value
                }
                return new se(Ue)
            }
            evaluateMacro(n, B) {
                return B.setVariable(n.name.value, new De( (w, O) => {
                    let K = new $e(O);
                    w = w.slice();
                    let ie;
                    w.at(-1)?.type === "KeywordArgumentsValue" && (ie = w.pop());
                    for (let fe = 0; fe < n.args.length; ++fe) {
                        let Ue = n.args[fe]
                          , Qe = w[fe];
                        if (Ue.type === "Identifier") {
                            let Oe = Ue;
                            if (!Qe)
                                throw new Error(`Missing positional argument: ${Oe.value}`);
                            K.setVariable(Oe.value, Qe)
                        } else if (Ue.type === "KeywordArgumentExpression") {
                            let Oe = Ue
                              , lt = Qe ?? ie?.value.get(Oe.key.value) ?? this.evaluate(Oe.value, K);
                            K.setVariable(Oe.key.value, lt)
                        } else
                            throw new Error(`Unknown argument type: ${Ue.type}`)
                    }
                    return this.evaluateBlock(n.body, K)
                }
                )),
                new Ve
            }
            evaluateCallStatement(n, B) {
                let w = new De( (Ue, Qe) => {
                    let Oe = new $e(Qe);
                    if (n.callerArgs)
                        for (let lt = 0; lt < n.callerArgs.length; ++lt) {
                            let ct = n.callerArgs[lt];
                            if (ct.type !== "Identifier")
                                throw new Error(`Caller parameter must be an identifier, got ${ct.type}`);
                            Oe.setVariable(ct.value, Ue[lt] ?? new Re)
                        }
                    return this.evaluateBlock(n.body, Oe)
                }
                )
                  , [O,K] = this.evaluateArguments(n.call.args, B);
                O.push(new ye(K));
                let ie = this.evaluate(n.call.callee, B);
                if (ie.type !== "FunctionValue")
                    throw new Error(`Cannot call something that is not a function: got ${ie.type}`);
                let fe = new $e(B);
                return fe.setVariable("caller", w),
                ie.value(O, fe)
            }
            evaluateFilterStatement(n, B) {
                let w = this.evaluateBlock(n.body, B);
                return this.applyFilter(w, n.filter, B)
            }
            evaluate(n, B) {
                if (!n)
                    return new Re;
                switch (n.type) {
                case "Program":
                    return this.evalProgram(n, B);
                case "Set":
                    return this.evaluateSet(n, B);
                case "If":
                    return this.evaluateIf(n, B);
                case "For":
                    return this.evaluateFor(n, B);
                case "Macro":
                    return this.evaluateMacro(n, B);
                case "CallStatement":
                    return this.evaluateCallStatement(n, B);
                case "Break":
                    throw new _e;
                case "Continue":
                    throw new ue;
                case "IntegerLiteral":
                    return new re(n.value);
                case "FloatLiteral":
                    return new pe(n.value);
                case "StringLiteral":
                    return new se(n.value);
                case "ArrayLiteral":
                    return new Pe(n.value.map(w => this.evaluate(w, B)));
                case "TupleLiteral":
                    return new Se(n.value.map(w => this.evaluate(w, B)));
                case "ObjectLiteral":
                    {
                        let w = new Map;
                        for (let[O,K] of n.value) {
                            let ie = this.evaluate(O, B);
                            if (!(ie instanceof se))
                                throw new Error(`Object keys must be strings: got ${ie.type}`);
                            w.set(ie.value, this.evaluate(K, B))
                        }
                        return new Ee(w)
                    }
                case "Identifier":
                    return this.evaluateIdentifier(n, B);
                case "CallExpression":
                    return this.evaluateCallExpression(n, B);
                case "MemberExpression":
                    return this.evaluateMemberExpression(n, B);
                case "UnaryExpression":
                    return this.evaluateUnaryExpression(n, B);
                case "BinaryExpression":
                    return this.evaluateBinaryExpression(n, B);
                case "FilterExpression":
                    return this.evaluateFilterExpression(n, B);
                case "FilterStatement":
                    return this.evaluateFilterStatement(n, B);
                case "TestExpression":
                    return this.evaluateTestExpression(n, B);
                case "SelectExpression":
                    return this.evaluateSelectExpression(n, B);
                case "Ternary":
                    return this.evaluateTernaryExpression(n, B);
                case "Comment":
                    return new Ve;
                default:
                    throw new SyntaxError(`Unknown node type: ${n.type}`)
                }
            }
        }
        ;
        function Ie(n) {
            switch (typeof n) {
            case "number":
                return Number.isInteger(n) ? new re(n) : new pe(n);
            case "string":
                return new se(n);
            case "boolean":
                return new Te(n);
            case "undefined":
                return new Re;
            case "object":
                return n === null ? new Ve : Array.isArray(n) ? new Pe(n.map(Ie)) : new Ee(new Map(Object.entries(n).map( ([B,w]) => [B, Ie(w)])));
            case "function":
                return new De( (B, w) => {
                    let O = n(...B.map(K => K.value)) ?? null;
                    return Ie(O)
                }
                );
            default:
                throw new Error(`Cannot convert to runtime value: ${n}`)
            }
        }
        function st(n, B, w) {
            let O = w ?? 0;
            switch (n.type) {
            case "NullValue":
            case "UndefinedValue":
                return "null";
            case "IntegerValue":
            case "FloatValue":
            case "StringValue":
            case "BooleanValue":
                return JSON.stringify(n.value);
            case "ArrayValue":
            case "ObjectValue":
                {
                    let K = B ? " ".repeat(B) : ""
                      , ie = `
` + K.repeat(O)
                      , fe = ie + K;
                    if (n.type === "ArrayValue") {
                        let Ue = n.value.map(Qe => st(Qe, B, O + 1));
                        return B ? `[${fe}${Ue.join(`,${fe}`)}${ie}]` : `[${Ue.join(", ")}]`
                    } else {
                        let Ue = Array.from(n.value.entries()).map( ([Qe,Oe]) => {
                            let lt = `"${Qe}": ${st(Oe, B, O + 1)}`;
                            return B ? `${fe}${lt}` : lt
                        }
                        );
                        return B ? `{${Ue.join(",")}${ie}}` : `{${Ue.join(", ")}}`
                    }
                }
            default:
                throw new Error(`Cannot convert to JSON: ${n.type}`)
            }
        }
        var qe = `
`
          , ht = "{%- "
          , Kt = " -%}";
        function Zt(n) {
            switch (n.operator.type) {
            case "MultiplicativeBinaryOperator":
                return 4;
            case "AdditiveBinaryOperator":
                return 3;
            case "ComparisonBinaryOperator":
                return 2;
            case "Identifier":
                return n.operator.value === "and" ? 1 : n.operator.value === "in" || n.operator.value === "not in" ? 2 : 0
            }
            return 0
        }
        function Gt(n, B="	") {
            let w = typeof B == "number" ? " ".repeat(B) : B;
            return $t(n.body, 0, w).replace(/\n$/, "")
        }
        function Ft(...n) {
            return ht + n.join(" ") + Kt
        }
        function $t(n, B, w) {
            return n.map(O => Rs(O, B, w)).join(qe)
        }
        function Rs(n, B, w) {
            let O = w.repeat(B);
            switch (n.type) {
            case "Program":
                return $t(n.body, B, w);
            case "If":
                return zs(n, B, w);
            case "For":
                return Gs(n, B, w);
            case "Set":
                return ds(n, B, w);
            case "Macro":
                return Ws(n, B, w);
            case "Break":
                return O + Ft("break");
            case "Continue":
                return O + Ft("continue");
            case "CallStatement":
                return Ye(n, B, w);
            case "FilterStatement":
                return Ls(n, B, w);
            case "Comment":
                return O + "{# " + n.value + " #}";
            default:
                return O + "{{- " + nt(n) + " -}}"
            }
        }
        function zs(n, B, w) {
            let O = w.repeat(B)
              , K = []
              , ie = n;
            for (; ie && (K.push({
                test: ie.test,
                body: ie.body
            }),
            ie.alternate.length === 1 && ie.alternate[0].type === "If"); )
                ie = ie.alternate[0];
            let fe = O + Ft("if", nt(K[0].test)) + qe + $t(K[0].body, B + 1, w);
            for (let Ue = 1; Ue < K.length; ++Ue)
                fe += qe + O + Ft("elif", nt(K[Ue].test)) + qe + $t(K[Ue].body, B + 1, w);
            return ie && ie.alternate.length > 0 && (fe += qe + O + Ft("else") + qe + $t(ie.alternate, B + 1, w)),
            fe += qe + O + Ft("endif"),
            fe
        }
        function Gs(n, B, w) {
            let O = w.repeat(B)
              , K = "";
            if (n.iterable.type === "SelectExpression") {
                let fe = n.iterable;
                K = `${nt(fe.lhs)} if ${nt(fe.test)}`
            } else
                K = nt(n.iterable);
            let ie = O + Ft("for", nt(n.loopvar), "in", K) + qe + $t(n.body, B + 1, w);
            return n.defaultBlock.length > 0 && (ie += qe + O + Ft("else") + qe + $t(n.defaultBlock, B + 1, w)),
            ie += qe + O + Ft("endfor"),
            ie
        }
        function ds(n, B, w) {
            let O = w.repeat(B)
              , K = nt(n.assignee)
              , ie = n.value ? nt(n.value) : ""
              , fe = O + Ft("set", `${K}${n.value ? " = " + ie : ""}`);
            return n.body.length === 0 ? fe : fe + qe + $t(n.body, B + 1, w) + qe + O + Ft("endset")
        }
        function Ws(n, B, w) {
            let O = w.repeat(B)
              , K = n.args.map(nt).join(", ");
            return O + Ft("macro", `${n.name.value}(${K})`) + qe + $t(n.body, B + 1, w) + qe + O + Ft("endmacro")
        }
        function Ye(n, B, w) {
            let O = w.repeat(B)
              , K = n.callerArgs && n.callerArgs.length > 0 ? `(${n.callerArgs.map(nt).join(", ")})` : ""
              , ie = nt(n.call)
              , fe = O + Ft(`call${K}`, ie) + qe;
            return fe += $t(n.body, B + 1, w) + qe,
            fe += O + Ft("endcall"),
            fe
        }
        function Ls(n, B, w) {
            let O = w.repeat(B)
              , K = n.filter.type === "Identifier" ? n.filter.value : nt(n.filter)
              , ie = O + Ft("filter", K) + qe;
            return ie += $t(n.body, B + 1, w) + qe,
            ie += O + Ft("endfilter"),
            ie
        }
        function nt(n, B=-1) {
            switch (n.type) {
            case "SpreadExpression":
                return `*${nt(n.argument)}`;
            case "Identifier":
                return n.value;
            case "IntegerLiteral":
                return `${n.value}`;
            case "FloatLiteral":
                return `${n.value}`;
            case "StringLiteral":
                return JSON.stringify(n.value);
            case "BinaryExpression":
                {
                    let w = n
                      , O = Zt(w)
                      , K = nt(w.left, O)
                      , ie = nt(w.right, O + 1)
                      , fe = `${K} ${w.operator.value} ${ie}`;
                    return O < B ? `(${fe})` : fe
                }
            case "UnaryExpression":
                {
                    let w = n;
                    return w.operator.value + (w.operator.value === "not" ? " " : "") + nt(w.argument, 1 / 0)
                }
            case "CallExpression":
                {
                    let w = n
                      , O = w.args.map(nt).join(", ");
                    return `${nt(w.callee)}(${O})`
                }
            case "MemberExpression":
                {
                    let w = n
                      , O = nt(w.object);
                    ["Identifier", "MemberExpression", "CallExpression", "StringLiteral", "IntegerLiteral", "FloatLiteral", "ArrayLiteral", "TupleLiteral", "ObjectLiteral"].includes(w.object.type) || (O = `(${O})`);
                    let K = nt(w.property);
                    return !w.computed && w.property.type !== "Identifier" && (K = `(${K})`),
                    w.computed ? `${O}[${K}]` : `${O}.${K}`
                }
            case "FilterExpression":
                {
                    let w = n
                      , O = nt(w.operand, 1 / 0);
                    return w.filter.type === "CallExpression" ? `${O} | ${nt(w.filter)}` : `${O} | ${w.filter.value}`
                }
            case "SelectExpression":
                {
                    let w = n;
                    return `${nt(w.lhs)} if ${nt(w.test)}`
                }
            case "TestExpression":
                {
                    let w = n;
                    return `${nt(w.operand)} is${w.negate ? " not" : ""} ${w.test.value}`
                }
            case "ArrayLiteral":
            case "TupleLiteral":
                {
                    let w = n.value.map(nt)
                      , O = n.type === "ArrayLiteral" ? "[]" : "()";
                    return `${O[0]}${w.join(", ")}${O[1]}`
                }
            case "ObjectLiteral":
                return `{${Array.from(n.value.entries()).map( ([O,K]) => `${nt(O)}: ${nt(K)}`).join(", ")}}`;
            case "SliceExpression":
                {
                    let w = n
                      , O = w.start ? nt(w.start) : ""
                      , K = w.stop ? nt(w.stop) : ""
                      , ie = w.step ? `:${nt(w.step)}` : "";
                    return `${O}:${K}${ie}`
                }
            case "KeywordArgumentExpression":
                {
                    let w = n;
                    return `${w.key.value}=${nt(w.value)}`
                }
            case "Ternary":
                {
                    let w = n
                      , O = `${nt(w.trueExpr)} if ${nt(w.condition, 0)} else ${nt(w.falseExpr)}`;
                    return B > -1 ? `(${O})` : O
                }
            default:
                throw new Error(`Unknown expression type: ${n.type}`)
            }
        }
        var As = class {
            parsed;
            constructor(n) {
                let B = L(n, {
                    lstrip_blocks: !0,
                    trim_blocks: !0
                });
                this.parsed = ae(B)
            }
            render(n) {
                let B = new $e;
                if (ze(B),
                n)
                    for (let[K,ie] of Object.entries(n))
                        B.set(K, ie);
                return new Ze(B).run(this.parsed).value
            }
            format(n) {
                return Gt(this.parsed, n?.indent || "	")
            }
        }
    }
    ),
    "./src/backends/onnx.js": ( (de, u, e) => {
        var l;
        e.r(u),
        e.d(u, {
            Tensor: () => C.Tensor,
            createInferenceSession: () => W,
            deviceToExecutionProviders: () => g,
            isONNXProxy: () => E,
            isONNXTensor: () => p,
            runInferenceSession: () => I
        });
        var h = e("./src/env.js")
          , b = e("?2ce3")
          , R = e("onnxruntime-web")
          , C = e("onnxruntime-common");
        let M = Object.freeze({
            auto: null,
            gpu: null,
            cpu: "cpu",
            wasm: "wasm",
            webgpu: "webgpu",
            cuda: "cuda",
            dml: "dml",
            webnn: {
                name: "webnn",
                deviceType: "cpu"
            },
            "webnn-npu": {
                name: "webnn",
                deviceType: "npu"
            },
            "webnn-gpu": {
                name: "webnn",
                deviceType: "gpu"
            },
            "webnn-cpu": {
                name: "webnn",
                deviceType: "cpu"
            }
        }), f = [], L, _, a = Symbol.for("onnxruntime");
        if (a in globalThis)
            _ = globalThis[a];
        else if (h.apis.IS_NODE_ENV) {
            switch (_ = b ?? (l || (l = e.t(b, 2))),
            __Process$.platform) {
            case "win32":
                f.push("dml");
                break;
            case "linux":
                __Process$.arch === "x64" && f.push("cuda");
                break;
            case "darwin":
                break
            }
            f.push("cpu"),
            L = ["cpu"]
        } else
            _ = R,
            h.apis.IS_WEBNN_AVAILABLE && f.push("webnn-npu", "webnn-gpu", "webnn-cpu", "webnn"),
            h.apis.IS_WEBGPU_AVAILABLE && f.push("webgpu"),
            f.push("wasm"),
            L = ["wasm"];
        let v = _.InferenceSession;
        function g(o=null) {
            if (!o)
                return L;
            switch (o) {
            case "auto":
                return f;
            case "gpu":
                return f.filter(d => ["webgpu", "cuda", "dml", "webnn-gpu"].includes(d))
            }
            if (f.includes(o))
                return [M[o] ?? o];
            throw new Error(`Unsupported device: "${o}". Should be one of: ${f.join(", ")}.`)
        }
        let y = null;
        async function W(o, d, x) {
            y && await y;
            let S = v.create(o, d);
            y ??= S;
            let N = await S;
            return N.config = x,
            N
        }
        let T = Promise.resolve()
          , k = h.apis.IS_BROWSER_ENV || h.apis.IS_WEBWORKER_ENV;
        async function I(o, d) {
            let x = () => o.run(d);
            return await (k ? T = T.then(x) : x())
        }
        function p(o) {
            return o instanceof _.Tensor
        }
        let m = _?.env;
        m?.wasm && (!(typeof ServiceWorkerGlobalScope < "u" && self instanceof ServiceWorkerGlobalScope) && !m.wasm.wasmPaths && (m.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${h.env.version}/dist/`),
        m.wasm.proxy = !1),
        m?.webgpu && (m.webgpu.powerPreference = "high-performance");
        function E() {
            return m?.wasm?.proxy
        }
        h.env.backends.onnx = m
    }
    ),
    "./src/base/feature_extraction_utils.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            FeatureExtractor: () => R,
            validate_audio_inputs: () => C
        });
        var l = e("./src/utils/constants.js")
          , h = e("./src/utils/generic.js")
          , b = e("./src/utils/hub.js");
        class R extends h.Callable {
            constructor(f) {
                super(),
                this.config = f
            }
            static async from_pretrained(f, L={}) {
                let _ = await (0,
                b.getModelJSON)(f, l.FEATURE_EXTRACTOR_NAME, !0, L);
                return new this(_)
            }
        }
        function C(M, f) {
            if (!(M instanceof Float32Array || M instanceof Float64Array))
                throw new Error(`${f} expects input to be a Float32Array or a Float64Array, but got ${M?.constructor?.name ?? typeof M} instead. If using the feature extractor directly, remember to use \`read_audio(url, sampling_rate)\` to obtain the raw audio data of the file/url.`)
        }
    }
    ),
    "./src/base/image_processors_utils.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ImageProcessor: () => m,
            center_to_corners_format: () => a,
            post_process_instance_segmentation: () => p,
            post_process_object_detection: () => v,
            post_process_panoptic_segmentation: () => I,
            post_process_semantic_segmentation: () => g
        });
        var l = e("./src/utils/generic.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/maths.js")
          , R = e("./src/utils/image.js")
          , C = e("./src/utils/core.js")
          , M = e("./src/utils/hub.js")
          , f = e("./src/utils/constants.js");
        function L(E, o, d=0, x=null) {
            let S = E / o
              , N = (0,
            b.bankers_round)(S) * o;
            return x !== null && N > x && (N = Math.floor(S) * o),
            N < d && (N = Math.ceil(S) * o),
            N
        }
        function _([E,o], d) {
            return [Math.max(Math.floor(E / d), 1) * d, Math.max(Math.floor(o / d), 1) * d]
        }
        function a([E,o,d,x]) {
            return [E - d / 2, o - x / 2, E + d / 2, o + x / 2]
        }
        function v(E, o=.5, d=null, x=!1) {
            let S = E.logits
              , N = E.pred_boxes
              , [j,D,$] = S.dims;
            if (d !== null && d.length !== j)
                throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
            let U = [];
            for (let H = 0; H < j; ++H) {
                let Z = d !== null ? d[H] : null
                  , ee = {
                    boxes: [],
                    classes: [],
                    scores: []
                }
                  , le = S[H]
                  , we = N[H];
                for (let ce = 0; ce < D; ++ce) {
                    let Q = le[ce], A = [], V;
                    if (x) {
                        V = Q.sigmoid().data;
                        for (let J = 0; J < V.length; ++J)
                            V[J] > o && A.push(J)
                    } else {
                        let J = (0,
                        b.max)(Q.data)[1];
                        if (J === $ - 1 || (V = (0,
                        b.softmax)(Q.data),
                        V[J] < o))
                            continue;
                        A.push(J)
                    }
                    for (let J of A) {
                        let ae = we[ce].data;
                        ae = a(ae),
                        Z !== null && (ae = ae.map( (xe, be) => xe * Z[(be + 1) % 2])),
                        ee.boxes.push(ae),
                        ee.classes.push(J),
                        ee.scores.push(V[J])
                    }
                }
                U.push(ee)
            }
            return U
        }
        function g(E, o=null) {
            let d = E.logits
              , x = d.dims[0];
            if (o !== null && o.length !== x)
                throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
            let S = [];
            for (let N = 0; N < x; ++N) {
                let j = o !== null ? o[N] : null
                  , D = d[N];
                j !== null && (D = (0,
                h.interpolate)(D, j, "bilinear", !1));
                let[$,U] = j ?? D.dims.slice(-2)
                  , H = new h.Tensor("int32",new Int32Array($ * U),[$, U])
                  , Z = D[0].data
                  , ee = H.data;
                for (let ce = 1; ce < D.dims[0]; ++ce) {
                    let Q = D[ce].data;
                    for (let A = 0; A < Q.length; ++A)
                        Q[A] > Z[A] && (Z[A] = Q[A],
                        ee[A] = ce)
                }
                let le = new Array(D.dims[0]);
                for (let ce = 0; ce < ee.length; ++ce) {
                    let Q = ee[ce];
                    le[Q] = Q
                }
                let we = le.filter(ce => ce !== void 0);
                S.push({
                    segmentation: H,
                    labels: we
                })
            }
            return S
        }
        function y(E, o, d, x) {
            let S = []
              , N = []
              , j = [];
            for (let D = 0; D < E.dims[0]; ++D) {
                let $ = E[D]
                  , U = o[D]
                  , H = (0,
                b.max)($.data)[1];
                if (H === x)
                    continue;
                let ee = (0,
                b.softmax)($.data)[H];
                ee > d && (S.push(U),
                N.push(ee),
                j.push(H))
            }
            return [S, N, j]
        }
        function W(E, o, d, x=.5, S=.8) {
            let N = []
              , j = 0
              , D = 0
              , $ = o[d].data;
            for (let H = 0; H < E.length; ++H)
                E[H] === d && (N.push(H),
                ++j),
                $[H] >= x && ++D;
            let U = j > 0 && D > 0;
            return U && (U = j / D > S),
            [U, N]
        }
        function T(E, o, d, x, S, N=null, j=null) {
            let[D,$] = j ?? E[0].dims
              , U = new h.Tensor("int32",new Int32Array(D * $),[D, $])
              , H = [];
            if (j !== null)
                for (let ce = 0; ce < E.length; ++ce)
                    E[ce] = (0,
                    h.interpolate)(E[ce], j, "bilinear", !1);
            let Z = new Int32Array(E[0].data.length)
              , ee = new Float32Array(E[0].data.length);
            for (let ce = 0; ce < E.length; ++ce) {
                let Q = o[ce]
                  , A = E[ce].data;
                for (let V = 0; V < A.length; ++V)
                    A[V] *= Q,
                    A[V] > ee[V] && (Z[V] = ce,
                    ee[V] = A[V])
            }
            let le = 0
              , we = U.data;
            for (let ce = 0; ce < d.length; ++ce) {
                let Q = d[ce]
                  , [A,V] = W(Z, E, ce, x, S);
                if (A) {
                    ++le;
                    for (let J of V)
                        we[J] = le;
                    H.push({
                        id: le,
                        label_id: Q,
                        score: o[ce]
                    })
                }
            }
            return [U, H]
        }
        function k(E, o, d=28, x=3136, S=784 * 1280) {
            if (E < d || o < d)
                throw new Error(`height:${E} or width:${o} must be larger than factor:${d}`);
            if (Math.max(E, o) / Math.min(E, o) > 200)
                throw new Error(`absolute aspect ratio must be smaller than 200, got ${Math.max(E, o) / Math.min(E, o)}`);
            let N = Math.round(E / d) * d
              , j = Math.round(o / d) * d;
            if (N * j > S) {
                let D = Math.sqrt(E * o / S);
                N = Math.floor(E / D / d) * d,
                j = Math.floor(o / D / d) * d
            } else if (N * j < x) {
                let D = Math.sqrt(x / (E * o));
                N = Math.ceil(E * D / d) * d,
                j = Math.ceil(o * D / d) * d
            }
            return [N, j]
        }
        function I(E, o=.5, d=.5, x=.8, S=null, N=null) {
            S === null && (console.warn("`label_ids_to_fuse` unset. No instance will be fused."),
            S = new Set);
            let j = E.class_queries_logits ?? E.logits
              , $ = (E.masks_queries_logits ?? E.pred_masks).sigmoid()
              , [U,H,Z] = j.dims;
            if (Z -= 1,
            N !== null && N.length !== U)
                throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
            let ee = [];
            for (let le = 0; le < U; ++le) {
                let we = N !== null ? N[le] : null
                  , ce = j[le]
                  , Q = $[le]
                  , [A,V,J] = y(ce, Q, o, Z);
                if (J.length === 0) {
                    let[be,Ae] = we ?? Q.dims.slice(-2)
                      , We = new h.Tensor("int32",new Int32Array(be * Ae).fill(-1),[be, Ae]);
                    ee.push({
                        segmentation: We,
                        segments_info: []
                    });
                    continue
                }
                let[ae,xe] = T(A, V, J, d, x, S, we);
                ee.push({
                    segmentation: ae,
                    segments_info: xe
                })
            }
            return ee
        }
        function p(E, o=.5, d=null) {
            throw new Error("`post_process_instance_segmentation` is not yet implemented.")
        }
        class m extends l.Callable {
            constructor(o) {
                super(),
                this.image_mean = o.image_mean ?? o.mean,
                this.image_std = o.image_std ?? o.std,
                this.resample = o.resample ?? 2,
                this.do_rescale = o.do_rescale ?? !0,
                this.rescale_factor = o.rescale_factor ?? 1 / 255,
                this.do_normalize = o.do_normalize,
                this.do_thumbnail = o.do_thumbnail,
                this.size = o.size ?? o.image_size,
                this.do_resize = o.do_resize ?? this.size !== void 0,
                this.size_divisibility = o.size_divisibility ?? o.size_divisor,
                this.do_center_crop = o.do_center_crop,
                this.crop_size = o.crop_size,
                this.do_convert_rgb = o.do_convert_rgb ?? !0,
                this.do_crop_margin = o.do_crop_margin,
                this.pad_size = o.pad_size,
                this.do_pad = o.do_pad,
                this.min_pixels = o.min_pixels,
                this.max_pixels = o.max_pixels,
                this.do_pad && !this.pad_size && this.size && this.size.width !== void 0 && this.size.height !== void 0 && (this.pad_size = this.size),
                this.do_flip_channel_order = o.do_flip_channel_order ?? !1,
                this.config = o
            }
            async thumbnail(o, d, x=2) {
                let S = o.height
                  , N = o.width
                  , j = d.height
                  , D = d.width
                  , $ = Math.min(S, j)
                  , U = Math.min(N, D);
                return $ === S && U === N ? o : (S > N ? U = Math.floor(N * $ / S) : N > S && ($ = Math.floor(S * U / N)),
                await o.resize(U, $, {
                    resample: x
                }))
            }
            async crop_margin(o, d=200) {
                let x = o.clone().grayscale()
                  , S = (0,
                b.min)(x.data)[0]
                  , j = (0,
                b.max)(x.data)[0] - S;
                if (j === 0)
                    return o;
                let D = d / 255
                  , $ = x.width
                  , U = x.height
                  , H = 0
                  , Z = 0
                  , ee = x.data;
                for (let le = 0; le < x.height; ++le) {
                    let we = le * x.width;
                    for (let ce = 0; ce < x.width; ++ce)
                        (ee[we + ce] - S) / j < D && ($ = Math.min($, ce),
                        U = Math.min(U, le),
                        H = Math.max(H, ce),
                        Z = Math.max(Z, le))
                }
                return o = await o.crop([$, U, H, Z]),
                o
            }
            pad_image(o, d, x, {mode: S="constant", center: N=!1, constant_values: j=0}={}) {
                let[D,$,U] = d, H, Z;
                if (typeof x == "number" ? (H = x,
                Z = x) : x === "square" ? H = Z = Math.max(D, $) : (H = x.width,
                Z = x.height),
                H !== $ || Z !== D) {
                    let ee = new Float32Array(H * Z * U);
                    if (Array.isArray(j))
                        for (let ce = 0; ce < ee.length; ++ce)
                            ee[ce] = j[ce % U];
                    else
                        j !== 0 && ee.fill(j);
                    let[le,we] = N ? [Math.floor((H - $) / 2), Math.floor((Z - D) / 2)] : [0, 0];
                    for (let ce = 0; ce < D; ++ce) {
                        let Q = (ce + we) * H
                          , A = ce * $;
                        for (let V = 0; V < $; ++V) {
                            let J = (Q + V + le) * U
                              , ae = (A + V) * U;
                            for (let xe = 0; xe < U; ++xe)
                                ee[J + xe] = o[ae + xe]
                        }
                    }
                    if (S === "symmetric") {
                        if (N)
                            throw new Error("`center` padding is not supported when `mode` is set to `symmetric`.");
                        let ce = D - 1
                          , Q = $ - 1;
                        for (let A = 0; A < Z; ++A) {
                            let V = A * H
                              , J = (0,
                            C.calculateReflectOffset)(A, ce) * $;
                            for (let ae = 0; ae < H; ++ae) {
                                if (A < D && ae < $)
                                    continue;
                                let xe = (V + ae) * U
                                  , be = (J + (0,
                                C.calculateReflectOffset)(ae, Q)) * U;
                                for (let Ae = 0; Ae < U; ++Ae)
                                    ee[xe + Ae] = o[be + Ae]
                            }
                        }
                    }
                    o = ee,
                    d = [Z, H, U]
                }
                return [o, d]
            }
            rescale(o) {
                for (let d = 0; d < o.length; ++d)
                    o[d] = this.rescale_factor * o[d]
            }
            get_resize_output_image_size(o, d) {
                let[x,S] = o.size, N, j;
                if (this.do_thumbnail) {
                    let {height: D, width: $} = d;
                    N = Math.min(D, $)
                } else
                    Number.isInteger(d) ? (N = d,
                    j = this.config.max_size ?? N) : d !== void 0 && (N = d.shortest_edge,
                    j = d.longest_edge);
                if (N !== void 0 || j !== void 0) {
                    let D = N === void 0 ? 1 : Math.max(N / x, N / S)
                      , $ = x * D
                      , U = S * D
                      , H = j === void 0 ? 1 : Math.min(j / $, j / U)
                      , Z = Math.floor(Number(($ * H).toFixed(2)))
                      , ee = Math.floor(Number((U * H).toFixed(2)));
                    return this.size_divisibility !== void 0 && ([Z,ee] = _([Z, ee], this.size_divisibility)),
                    [Z, ee]
                } else if (d !== void 0 && d.width !== void 0 && d.height !== void 0) {
                    let D = d.width
                      , $ = d.height;
                    if (this.config.keep_aspect_ratio && this.config.ensure_multiple_of) {
                        let U = $ / S
                          , H = D / x;
                        Math.abs(1 - H) < Math.abs(1 - U) ? U = H : H = U,
                        $ = L(U * S, this.config.ensure_multiple_of),
                        D = L(H * x, this.config.ensure_multiple_of)
                    }
                    return [D, $]
                } else {
                    if (this.size_divisibility !== void 0)
                        return _([x, S], this.size_divisibility);
                    if (this.min_pixels !== void 0 && this.max_pixels !== void 0) {
                        let D = this.config.patch_size * this.config.merge_size;
                        return k(S, x, D, this.min_pixels, this.max_pixels)
                    } else
                        throw new Error(`Could not resize image due to unsupported \`this.size\` option in config: ${JSON.stringify(d)}`)
                }
            }
            async resize(o) {
                let[d,x] = this.get_resize_output_image_size(o, this.size);
                return await o.resize(d, x, {
                    resample: this.resample
                })
            }
            async preprocess(o, {do_normalize: d=null, do_pad: x=null, do_convert_rgb: S=null, do_convert_grayscale: N=null, do_flip_channel_order: j=null}={}) {
                this.do_crop_margin && (o = await this.crop_margin(o));
                let[D,$] = o.size;
                if (S ?? this.do_convert_rgb ? o = o.rgb() : N && (o = o.grayscale()),
                this.do_resize && (o = await this.resize(o)),
                this.do_thumbnail && (o = await this.thumbnail(o, this.size, this.resample)),
                this.do_center_crop) {
                    let le, we;
                    Number.isInteger(this.crop_size) ? (le = this.crop_size,
                    we = this.crop_size) : (le = this.crop_size.width,
                    we = this.crop_size.height),
                    o = await o.center_crop(le, we)
                }
                let U = [o.height, o.width]
                  , H = Float32Array.from(o.data)
                  , Z = [o.height, o.width, o.channels];
                if (this.do_rescale && this.rescale(H),
                d ?? this.do_normalize) {
                    let le = this.image_mean;
                    Array.isArray(this.image_mean) || (le = new Array(o.channels).fill(le));
                    let we = this.image_std;
                    if (Array.isArray(this.image_std) || (we = new Array(o.channels).fill(we)),
                    le.length !== o.channels || we.length !== o.channels)
                        throw new Error(`When set to arrays, the length of \`image_mean\` (${le.length}) and \`image_std\` (${we.length}) must match the number of channels in the image (${o.channels}).`);
                    for (let ce = 0; ce < H.length; ce += o.channels)
                        for (let Q = 0; Q < o.channels; ++Q)
                            H[ce + Q] = (H[ce + Q] - le[Q]) / we[Q]
                }
                if (x ?? this.do_pad) {
                    if (this.pad_size)
                        [H,Z] = this.pad_image(H, [o.height, o.width, o.channels], this.pad_size);
                    else if (this.size_divisibility) {
                        let[le,we] = _([Z[1], Z[0]], this.size_divisibility);
                        [H,Z] = this.pad_image(H, Z, {
                            width: le,
                            height: we
                        })
                    }
                }
                if (j ?? this.do_flip_channel_order) {
                    if (Z[2] !== 3)
                        throw new Error("Flipping channel order is only supported for RGB images.");
                    for (let le = 0; le < H.length; le += 3) {
                        let we = H[le];
                        H[le] = H[le + 2],
                        H[le + 2] = we
                    }
                }
                let ee = new h.Tensor("float32",H,Z).permute(2, 0, 1);
                return {
                    original_size: [$, D],
                    reshaped_input_size: U,
                    pixel_values: ee
                }
            }
            async _call(o, ...d) {
                Array.isArray(o) || (o = [o]);
                let x = await Promise.all(o.map(N => this.preprocess(N)));
                return {
                    pixel_values: (0,
                    h.stack)(x.map(N => N.pixel_values), 0),
                    original_sizes: x.map(N => N.original_size),
                    reshaped_input_sizes: x.map(N => N.reshaped_input_size)
                }
            }
            static async from_pretrained(o, d={}) {
                let x = await (0,
                M.getModelJSON)(o, f.IMAGE_PROCESSOR_NAME, !0, d);
                return new this(x)
            }
        }
    }
    ),
    "./src/base/processing_utils.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Processor: () => R
        });
        var l = e("./src/utils/constants.js")
          , h = e("./src/utils/generic.js")
          , b = e("./src/utils/hub.js");
        class R extends h.Callable {
            static classes = ["image_processor_class", "tokenizer_class", "feature_extractor_class"];
            static uses_processor_config = !1;
            static uses_chat_template_file = !1;
            constructor(M, f, L) {
                super(),
                this.config = M,
                this.components = f,
                this.chat_template = L
            }
            get image_processor() {
                return this.components.image_processor
            }
            get tokenizer() {
                return this.components.tokenizer
            }
            get feature_extractor() {
                return this.components.feature_extractor
            }
            apply_chat_template(M, f={}) {
                if (!this.tokenizer)
                    throw new Error("Unable to apply chat template without a tokenizer.");
                return this.tokenizer.apply_chat_template(M, {
                    tokenize: !1,
                    chat_template: this.chat_template ?? void 0,
                    ...f
                })
            }
            batch_decode(...M) {
                if (!this.tokenizer)
                    throw new Error("Unable to decode without a tokenizer.");
                return this.tokenizer.batch_decode(...M)
            }
            decode(...M) {
                if (!this.tokenizer)
                    throw new Error("Unable to decode without a tokenizer.");
                return this.tokenizer.decode(...M)
            }
            async _call(M, ...f) {
                for (let L of [this.image_processor, this.feature_extractor, this.tokenizer])
                    if (L)
                        return L(M, ...f);
                throw new Error("No image processor, feature extractor, or tokenizer found.")
            }
            static async from_pretrained(M, f={}) {
                let[L,_,a] = await Promise.all([this.uses_processor_config ? (0,
                b.getModelJSON)(M, l.PROCESSOR_NAME, !0, f) : {}, Promise.all(this.classes.filter(v => v in this).map(async v => {
                    let g = await this[v].from_pretrained(M, f);
                    return [v.replace(/_class$/, ""), g]
                }
                )).then(Object.fromEntries), this.uses_chat_template_file ? (0,
                b.getModelText)(M, l.CHAT_TEMPLATE_NAME, !0, f) : null]);
                return new this(L,_,a)
            }
        }
    }
    ),
    "./src/configs.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AutoConfig: () => L,
            PretrainedConfig: () => f,
            getCacheShapes: () => C
        });
        var l = e("./src/utils/core.js")
          , h = e("./src/utils/hub.js");
        async function b(_, a) {
            return await (0,
            h.getModelJSON)(_, "config.json", !0, a)
        }
        function R(_) {
            let a = {}
              , v = {};
            switch (_.model_type) {
            case "llava":
            case "paligemma":
            case "gemma3":
            case "florence2":
            case "llava_onevision":
            case "idefics3":
            case "ultravox":
            case "voxtral":
            case "smolvlm":
            case "gemma3n":
                v = R(_.text_config);
                break;
            case "moondream1":
                v = R(_.phi_config);
                break;
            case "musicgen":
                v = R(_.decoder);
                break;
            case "multi_modality":
                v = R(_.language_config);
                break;
            case "gpt2":
            case "gptj":
            case "jais":
            case "codegen":
            case "gpt_bigcode":
                a.num_heads = "n_head",
                a.num_layers = "n_layer",
                a.hidden_size = "n_embd";
                break;
            case "gpt_neox":
            case "stablelm":
            case "opt":
            case "falcon":
            case "modernbert-decoder":
                a.num_heads = "num_attention_heads",
                a.num_layers = "num_hidden_layers",
                a.hidden_size = "hidden_size";
                break;
            case "llama":
            case "llama4_text":
            case "nanochat":
            case "arcee":
            case "lfm2":
            case "smollm3":
            case "olmo":
            case "olmo2":
            case "mobilellm":
            case "granite":
            case "granitemoehybrid":
            case "cohere":
            case "mistral":
            case "starcoder2":
            case "qwen2":
            case "qwen2_vl":
            case "phi":
            case "phi3":
            case "phi3_v":
            case "llava_qwen2":
                a.num_heads = "num_key_value_heads",
                a.num_layers = "num_hidden_layers",
                a.hidden_size = "hidden_size",
                a.num_attention_heads = "num_attention_heads",
                a.dim_kv = "head_dim";
                break;
            case "qwen3":
            case "gemma":
            case "gemma2":
            case "vaultgemma":
            case "gemma3_text":
            case "gemma3n_text":
            case "glm":
            case "helium":
            case "ernie4_5":
                a.num_heads = "num_key_value_heads",
                a.num_layers = "num_hidden_layers",
                a.dim_kv = "head_dim";
                break;
            case "openelm":
                a.num_heads = "num_kv_heads",
                a.num_layers = "num_transformer_layers",
                a.dim_kv = "head_dim";
                break;
            case "gpt_neo":
            case "donut-swin":
                a.num_heads = "num_heads",
                a.num_layers = "num_layers",
                a.hidden_size = "hidden_size";
                break;
            case "bloom":
                a.num_heads = "n_head",
                a.num_layers = "n_layer",
                a.hidden_size = "hidden_size";
                break;
            case "mpt":
                a.num_heads = "n_heads",
                a.num_layers = "n_layers",
                a.hidden_size = "d_model";
                break;
            case "exaone":
                a.num_heads = "num_key_value_heads",
                a.num_layers = "num_layers",
                a.dim_kv = "head_dim",
                a.num_attention_heads = "num_attention_heads";
                break;
            case "t5":
            case "mt5":
            case "longt5":
                a.num_decoder_layers = "num_decoder_layers",
                a.num_decoder_heads = "num_heads",
                a.decoder_dim_kv = "d_kv",
                a.num_encoder_layers = "num_layers",
                a.num_encoder_heads = "num_heads",
                a.encoder_dim_kv = "d_kv";
                break;
            case "bart":
            case "mbart":
            case "marian":
            case "whisper":
            case "lite-whisper":
            case "m2m_100":
            case "blenderbot":
            case "blenderbot-small":
            case "florence2_language":
                a.num_decoder_layers = "decoder_layers",
                a.num_decoder_heads = "decoder_attention_heads",
                a.decoder_hidden_size = "d_model",
                a.num_encoder_layers = "encoder_layers",
                a.num_encoder_heads = "encoder_attention_heads",
                a.encoder_hidden_size = "d_model";
                break;
            case "speecht5":
                a.num_decoder_layers = "decoder_layers",
                a.num_decoder_heads = "decoder_attention_heads",
                a.decoder_hidden_size = "hidden_size",
                a.num_encoder_layers = "encoder_layers",
                a.num_encoder_heads = "encoder_attention_heads",
                a.encoder_hidden_size = "hidden_size";
                break;
            case "trocr":
                a.num_encoder_layers = a.num_decoder_layers = "decoder_layers",
                a.num_encoder_heads = a.num_decoder_heads = "decoder_attention_heads",
                a.encoder_hidden_size = a.decoder_hidden_size = "d_model";
                break;
            case "musicgen_decoder":
                a.num_encoder_layers = a.num_decoder_layers = "num_hidden_layers",
                a.num_encoder_heads = a.num_decoder_heads = "num_attention_heads",
                a.encoder_hidden_size = a.decoder_hidden_size = "hidden_size";
                break;
            case "moonshine":
                a.num_decoder_layers = "decoder_num_hidden_layers",
                a.num_decoder_heads = "decoder_num_key_value_heads",
                a.num_encoder_layers = "encoder_num_hidden_layers",
                a.num_encoder_heads = "encoder_num_key_value_heads",
                a.encoder_hidden_size = a.decoder_hidden_size = "hidden_size";
                break;
            case "vision-encoder-decoder":
                let y = R(_.decoder)
                  , W = "num_decoder_layers"in y
                  , T = (0,
                l.pick)(_, ["model_type", "is_encoder_decoder"]);
                return W ? (T.num_decoder_layers = y.num_decoder_layers,
                T.num_decoder_heads = y.num_decoder_heads,
                T.decoder_hidden_size = y.decoder_hidden_size,
                T.num_encoder_layers = y.num_encoder_layers,
                T.num_encoder_heads = y.num_encoder_heads,
                T.encoder_hidden_size = y.encoder_hidden_size) : (T.num_layers = y.num_layers,
                T.num_heads = y.num_heads,
                T.hidden_size = y.hidden_size),
                T
            }
            let g = {
                ...v,
                ...(0,
                l.pick)(_, ["model_type", "multi_query", "is_encoder_decoder"])
            };
            for (let y in a)
                g[y] = _[a[y]];
            return g
        }
        function C(_, a) {
            if (_.model_type === "lfm2") {
                let v = a?.prefix ?? "past_key_values"
                  , g = v === "present" ? "present" : "past"
                  , y = {}
                  , {layer_types: W, num_attention_heads: T, num_key_value_heads: k, hidden_size: I, conv_L_cache: p} = _
                  , m = I / T
                  , E = a?.batch_size ?? 1;
                for (let o = 0; o < W.length; ++o)
                    if (W[o] === "full_attention")
                        for (let d of ["key", "value"])
                            y[`${v}.${o}.${d}`] = [E, k, 0, m];
                    else if (W[o] === "conv")
                        y[`${g}_conv.${o}`] = [E, I, p];
                    else
                        throw new Error(`Unsupported layer type: ${W[o]}`);
                return y
            }
            return M(_, a)
        }
        function M(_, {prefix: a="past_key_values", batch_size: v=1}={}) {
            let g = {}
              , y = _.normalized_config;
            if (y.is_encoder_decoder && "num_encoder_heads"in y && "num_decoder_heads"in y) {
                let W = y.encoder_dim_kv ?? y.encoder_hidden_size / y.num_encoder_heads
                  , T = y.decoder_dim_kv ?? y.decoder_hidden_size / y.num_decoder_heads
                  , k = [v, y.num_encoder_heads, 0, W]
                  , I = [v, y.num_decoder_heads, 0, T];
                for (let p = 0; p < y.num_decoder_layers; ++p)
                    g[`${a}.${p}.encoder.key`] = k,
                    g[`${a}.${p}.encoder.value`] = k,
                    g[`${a}.${p}.decoder.key`] = I,
                    g[`${a}.${p}.decoder.value`] = I
            } else {
                let W = y.num_heads
                  , T = y.num_layers
                  , k = y.dim_kv ?? y.hidden_size / (y.num_attention_heads ?? W);
                if (y.model_type === "falcon") {
                    let I = [v * W, 0, k];
                    for (let p = 0; p < T; ++p)
                        g[`${a}.${p}.key`] = I,
                        g[`${a}.${p}.value`] = I
                } else if (y.multi_query) {
                    let I = [v * W, 0, 2 * k];
                    for (let p = 0; p < T; ++p)
                        g[`${a}.${p}.key_value`] = I
                } else if (y.model_type === "bloom") {
                    let I = [v * W, k, 0]
                      , p = [v * W, 0, k];
                    for (let m = 0; m < T; ++m)
                        g[`${a}.${m}.key`] = I,
                        g[`${a}.${m}.value`] = p
                } else if (y.model_type === "openelm")
                    for (let I = 0; I < T; ++I) {
                        let p = [v, W[I], 0, k];
                        g[`${a}.${I}.key`] = p,
                        g[`${a}.${I}.value`] = p
                    }
                else {
                    let I = [v, W, 0, k];
                    for (let p = 0; p < T; ++p)
                        g[`${a}.${p}.key`] = I,
                        g[`${a}.${p}.value`] = I
                }
            }
            return g
        }
        class f {
            model_type = null;
            is_encoder_decoder = !1;
            max_position_embeddings;
            "transformers.js_config";
            constructor(a) {
                Object.assign(this, a),
                this.normalized_config = R(this)
            }
            static async from_pretrained(a, {progress_callback: v=null, config: g=null, cache_dir: y=null, local_files_only: W=!1, revision: T="main"}={}) {
                g && !(g instanceof f) && (g = new f(g));
                let k = g ?? await b(a, {
                    progress_callback: v,
                    config: g,
                    cache_dir: y,
                    local_files_only: W,
                    revision: T
                });
                return new this(k)
            }
        }
        class L {
            static async from_pretrained(...a) {
                return f.from_pretrained(...a)
            }
        }
    }
    ),
    "./src/env.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            apis: () => k,
            env: () => d
        });
        var l = e("?db59")
          , h = e("?383f")
          , b = e("?fa4b");
        let R = "3.8.0"
          , C = typeof window < "u" && typeof window.document < "u"
          , M = typeof self < "u" && ["DedicatedWorkerGlobalScope", "ServiceWorkerGlobalScope", "SharedWorkerGlobalScope"].includes(self.constructor?.name)
          , f = typeof self < "u" && "caches"in self
          , L = typeof navigator < "u" && "gpu"in navigator
          , _ = typeof navigator < "u" && "ml"in navigator
          , a = typeof __Process$ < "u"
          , v = a && __Process$?.release?.name === "node"
          , g = !x(l)
          , y = !x(h)
          , W = typeof globalThis.Deno < "u"
          , T = typeof globalThis.Bun < "u"
          , k = Object.freeze({
            IS_BROWSER_ENV: C,
            IS_WEBWORKER_ENV: M,
            IS_WEB_CACHE_AVAILABLE: f,
            IS_WEBGPU_AVAILABLE: L,
            IS_WEBNN_AVAILABLE: _,
            IS_PROCESS_AVAILABLE: a,
            IS_NODE_ENV: v,
            IS_FS_AVAILABLE: g,
            IS_PATH_AVAILABLE: y
        })
          , I = g && y
          , p = "./";
        if (I) {
            let S = Object(import.meta).url;
            S ? p = h.dirname(h.dirname(b.fileURLToPath(S))) : p = h.dirname("/@huggingface/transformers@3.8.0/es2022")
        }
        let m = I ? h.join(p, "/.cache/") : null
          , E = "/models/"
          , o = I ? h.join(p, E) : E
          , d = {
            version: R,
            backends: {
                onnx: {}
            },
            allowRemoteModels: !0,
            remoteHost: "https://huggingface.co/",
            remotePathTemplate: "{model}/resolve/{revision}/",
            allowLocalModels: !(C || M),
            localModelPath: o,
            useFS: g,
            useBrowserCache: f && !W,
            useFSCache: g,
            cacheDir: m,
            useCustomCache: !1,
            customCache: null
        };
        function x(S) {
            return Object.keys(S).length === 0
        }
    }
    ),
    "./src/generation/configuration_utils.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            GenerationConfig: () => h
        });
        var l = e("./src/utils/core.js");
        class h {
            max_length = 20;
            max_new_tokens = null;
            min_length = 0;
            min_new_tokens = null;
            early_stopping = !1;
            max_time = null;
            do_sample = !1;
            num_beams = 1;
            num_beam_groups = 1;
            penalty_alpha = null;
            use_cache = !0;
            temperature = 1;
            top_k = 50;
            top_p = 1;
            typical_p = 1;
            epsilon_cutoff = 0;
            eta_cutoff = 0;
            diversity_penalty = 0;
            repetition_penalty = 1;
            encoder_repetition_penalty = 1;
            length_penalty = 1;
            no_repeat_ngram_size = 0;
            bad_words_ids = null;
            force_words_ids = null;
            renormalize_logits = !1;
            constraints = null;
            forced_bos_token_id = null;
            forced_eos_token_id = null;
            remove_invalid_values = !1;
            exponential_decay_length_penalty = null;
            suppress_tokens = null;
            streamer = null;
            begin_suppress_tokens = null;
            forced_decoder_ids = null;
            guidance_scale = null;
            num_return_sequences = 1;
            output_attentions = !1;
            output_hidden_states = !1;
            output_scores = !1;
            return_dict_in_generate = !1;
            pad_token_id = null;
            bos_token_id = null;
            eos_token_id = null;
            encoder_no_repeat_ngram_size = 0;
            decoder_start_token_id = null;
            generation_kwargs = {};
            constructor(R) {
                Object.assign(this, (0,
                l.pick)(R, Object.getOwnPropertyNames(this)))
            }
        }
    }
    ),
    "./src/generation/logits_process.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ClassifierFreeGuidanceLogitsProcessor: () => k,
            ForcedBOSTokenLogitsProcessor: () => f,
            ForcedEOSTokenLogitsProcessor: () => L,
            LogitsProcessor: () => R,
            LogitsProcessorList: () => M,
            LogitsWarper: () => C,
            MinLengthLogitsProcessor: () => y,
            MinNewTokensLengthLogitsProcessor: () => W,
            NoBadWordsLogitsProcessor: () => T,
            NoRepeatNGramLogitsProcessor: () => v,
            RepetitionPenaltyLogitsProcessor: () => g,
            SuppressTokensAtBeginLogitsProcessor: () => _,
            TemperatureLogitsWarper: () => I,
            TopKLogitsWarper: () => m,
            TopPLogitsWarper: () => p,
            WhisperTimeStampLogitsProcessor: () => a
        });
        var l = e("./src/utils/generic.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/maths.js");
        class R extends l.Callable {
            _call(o, d) {
                throw Error("`_call` should be implemented in a subclass")
            }
        }
        class C extends l.Callable {
            _call(o, d) {
                throw Error("`_call` should be implemented in a subclass")
            }
        }
        class M extends l.Callable {
            constructor() {
                super(),
                this.processors = []
            }
            push(o) {
                this.processors.push(o)
            }
            extend(o) {
                this.processors.push(...o)
            }
            _call(o, d) {
                let x = d;
                for (let S of this.processors)
                    x = S(o, x);
                return x
            }
            [Symbol.iterator]() {
                return this.processors.values()
            }
        }
        class f extends R {
            constructor(o) {
                super(),
                this.bos_token_id = o
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x)
                    if (o[x].length === 1) {
                        let S = d[x].data;
                        S.fill(-1 / 0),
                        S[this.bos_token_id] = 0
                    }
                return d
            }
        }
        class L extends R {
            constructor(o, d) {
                super(),
                this.max_length = o,
                this.eos_token_id = Array.isArray(d) ? d : [d]
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x)
                    if (o[x].length === this.max_length - 1) {
                        let S = d[x].data;
                        S.fill(-1 / 0);
                        for (let N of this.eos_token_id)
                            S[N] = 0
                    }
                return d
            }
        }
        class _ extends R {
            constructor(o, d) {
                super(),
                this.begin_suppress_tokens = o,
                this.begin_index = d
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x)
                    if (o[x].length === this.begin_index) {
                        let S = d[x].data;
                        for (let N of this.begin_suppress_tokens)
                            S[N] = -1 / 0
                    }
                return d
            }
        }
        class a extends R {
            constructor(o, d) {
                super(),
                this.eos_token_id = Array.isArray(o.eos_token_id) ? o.eos_token_id[0] : o.eos_token_id,
                this.no_timestamps_token_id = o.no_timestamps_token_id,
                this.timestamp_begin = this.no_timestamps_token_id + 1,
                this.begin_index = d.length,
                d.at(-1) === this.no_timestamps_token_id && (this.begin_index -= 1),
                this.max_initial_timestamp_index = o.max_initial_timestamp_index
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x) {
                    let S = d[x].data;
                    if (S[this.no_timestamps_token_id] = -1 / 0,
                    o[x].length === this.begin_index - 1) {
                        S.fill(-1 / 0),
                        S[this.timestamp_begin] = 0;
                        continue
                    }
                    let N = o[x].slice(this.begin_index)
                      , j = N.length >= 1 && N[N.length - 1] >= this.timestamp_begin
                      , D = N.length < 2 || N[N.length - 2] >= this.timestamp_begin;
                    if (j && (D ? S.subarray(this.timestamp_begin).fill(-1 / 0) : S.subarray(0, this.eos_token_id).fill(-1 / 0)),
                    o[x].length === this.begin_index && this.max_initial_timestamp_index !== null) {
                        let Z = this.timestamp_begin + this.max_initial_timestamp_index;
                        S.subarray(Z + 1).fill(-1 / 0)
                    }
                    let $ = (0,
                    b.log_softmax)(S)
                      , U = Math.log($.subarray(this.timestamp_begin).map(Math.exp).reduce( (Z, ee) => Z + ee))
                      , H = (0,
                    b.max)($.subarray(0, this.timestamp_begin))[0];
                    U > H && S.subarray(0, this.timestamp_begin).fill(-1 / 0)
                }
                return d
            }
        }
        class v extends R {
            constructor(o) {
                super(),
                this.no_repeat_ngram_size = o
            }
            getNgrams(o) {
                let d = o.length
                  , x = [];
                for (let N = 0; N < d + 1 - this.no_repeat_ngram_size; ++N) {
                    let j = [];
                    for (let D = 0; D < this.no_repeat_ngram_size; ++D)
                        j.push(o[N + D]);
                    x.push(j.map(Number))
                }
                let S = new Map;
                for (let N of x) {
                    let j = N.slice(0, N.length - 1)
                      , D = JSON.stringify(j)
                      , $ = S.get(D) ?? [];
                    $.push(N[N.length - 1]),
                    S.set(D, $)
                }
                return S
            }
            getGeneratedNgrams(o, d) {
                let x = d.slice(d.length + 1 - this.no_repeat_ngram_size, d.length);
                return o.get(JSON.stringify(x.map(Number))) ?? []
            }
            calcBannedNgramTokens(o) {
                let d = [];
                if (o.length + 1 < this.no_repeat_ngram_size)
                    return d;
                {
                    let x = this.getNgrams(o);
                    return this.getGeneratedNgrams(x, o)
                }
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x) {
                    let S = d[x].data
                      , N = this.calcBannedNgramTokens(o[x]);
                    for (let j of N)
                        S[j] = -1 / 0
                }
                return d
            }
        }
        class g extends R {
            constructor(o) {
                super(),
                this.penalty = o
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x) {
                    let S = d[x].data;
                    for (let N of new Set(o[x])) {
                        let j = Number(N);
                        S[j] < 0 ? S[j] *= this.penalty : S[j] /= this.penalty
                    }
                }
                return d
            }
        }
        class y extends R {
            constructor(o, d) {
                super(),
                this.min_length = o,
                this.eos_token_id = Array.isArray(d) ? d : [d]
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x)
                    if (o[x].length < this.min_length) {
                        let S = d[x].data;
                        for (let N of this.eos_token_id)
                            S[N] = -1 / 0
                    }
                return d
            }
        }
        class W extends R {
            constructor(o, d, x) {
                super(),
                this.prompt_length_to_skip = o,
                this.min_new_tokens = d,
                this.eos_token_id = Array.isArray(x) ? x : [x]
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x)
                    if (o[x].length - this.prompt_length_to_skip < this.min_new_tokens) {
                        let N = d[x].data;
                        for (let j of this.eos_token_id)
                            N[j] = -1 / 0
                    }
                return d
            }
        }
        class T extends R {
            constructor(o, d) {
                super(),
                this.bad_words_ids = o,
                this.eos_token_id = Array.isArray(d) ? d : [d]
            }
            _call(o, d) {
                for (let x = 0; x < o.length; ++x) {
                    let S = d[x].data
                      , N = o[x];
                    for (let j of this.bad_words_ids) {
                        if (N.length < j.length - 1)
                            continue;
                        let D = !0;
                        for (let $ = 1; $ <= j.length - 1; ++$)
                            if (j.at(-$ - 1) != N.at(-$)) {
                                D = !1;
                                break
                            }
                        D && (S[j.at(-1)] = -1 / 0)
                    }
                }
                return d
            }
        }
        class k extends R {
            constructor(o) {
                if (super(),
                o <= 1)
                    throw new Error(`Require guidance scale >1 to use the classifier free guidance processor, got guidance scale ${o}.`);
                this.guidance_scale = o
            }
            _call(o, d) {
                if (d.dims[0] !== 2 * o.length)
                    throw new Error(`Logits should have twice the batch size of the input ids, the first half of batches corresponding to the conditional inputs, and the second half of batches corresponding to the unconditional inputs. Got batch size ${d.dims[0]} for the logits and ${o.length} for the input ids.`);
                let x = o.length
                  , S = d.slice([0, x], null)
                  , N = d.slice([x, d.dims[0]], null);
                for (let j = 0; j < N.data.length; ++j)
                    N.data[j] += (S.data[j] - N.data[j]) * this.guidance_scale;
                return N
            }
        }
        class I extends C {
            constructor(o) {
                if (super(),
                typeof o != "number" || o <= 0) {
                    let d = `\`temperature\` (=${o}) must be a strictly positive float, otherwise your next token scores will be invalid.`;
                    o === 0 && (d += " If you're looking for greedy decoding strategies, set `do_sample=false`.")
                }
                this.temperature = o
            }
            _call(o, d) {
                let x = d.data;
                for (let S = 0; S < x.length; ++S)
                    x[S] /= this.temperature;
                return d
            }
        }
        class p extends C {
            constructor(o, {filter_value: d=-1 / 0, min_tokens_to_keep: x=1}={}) {
                if (super(),
                o < 0 || o > 1)
                    throw new Error(`\`top_p\` must be a float > 0 and < 1, but is ${o}`);
                if (!Number.isInteger(x) || x < 1)
                    throw new Error(`\`min_tokens_to_keep\` must be a positive integer, but is ${x}`);
                this.top_p = o,
                this.filter_value = d,
                this.min_tokens_to_keep = x
            }
        }
        class m extends C {
            constructor(o, {filter_value: d=-1 / 0, min_tokens_to_keep: x=1}={}) {
                if (super(),
                !Number.isInteger(o) || o < 0)
                    throw new Error(`\`top_k\` must be a positive integer, but is ${o}`);
                this.top_k = Math.max(o, x),
                this.filter_value = d
            }
        }
    }
    ),
    "./src/generation/logits_sampler.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            LogitsSampler: () => C
        });
        var l = e("./src/utils/generic.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/maths.js")
          , R = e("./src/generation/configuration_utils.js");
        class C extends l.Callable {
            constructor(a) {
                super(),
                this.generation_config = a
            }
            async _call(a) {
                return this.sample(a)
            }
            async sample(a) {
                throw Error("sample should be implemented in subclasses.")
            }
            getLogits(a, v) {
                let g = a.dims.at(-1)
                  , y = a.data;
                if (v === -1)
                    y = y.slice(-g);
                else {
                    let W = v * g;
                    y = y.slice(W, W + g)
                }
                return y
            }
            randomSelect(a) {
                let v = 0;
                for (let y = 0; y < a.length; ++y)
                    v += a[y];
                let g = Math.random() * v;
                for (let y = 0; y < a.length; ++y)
                    if (g -= a[y],
                    g <= 0)
                        return y;
                return 0
            }
            static getSampler(a) {
                if (a.do_sample)
                    return new f(a);
                if (a.num_beams > 1)
                    return new L(a);
                if (a.num_return_sequences > 1)
                    throw Error(`num_return_sequences has to be 1 when doing greedy search, but is ${a.num_return_sequences}.`);
                return new M(a)
            }
        }
        class M extends C {
            async sample(a) {
                let v = (0,
                b.max)(a.data)[1];
                return [[BigInt(v), 0]]
            }
        }
        class f extends C {
            async sample(a) {
                let v = a.dims.at(-1);
                this.generation_config.top_k > 0 && (v = Math.min(this.generation_config.top_k, v));
                let[g,y] = await (0,
                h.topk)(a, v)
                  , W = (0,
                b.softmax)(g.data);
                return Array.from({
                    length: this.generation_config.num_beams
                }, () => {
                    let T = this.randomSelect(W);
                    return [y.data[T], Math.log(W[T])]
                }
                )
            }
        }
        class L extends C {
            async sample(a) {
                let v = a.dims.at(-1);
                this.generation_config.top_k > 0 && (v = Math.min(this.generation_config.top_k, v));
                let[g,y] = await (0,
                h.topk)(a, v)
                  , W = (0,
                b.softmax)(g.data);
                return Array.from({
                    length: this.generation_config.num_beams
                }, (T, k) => [y.data[k], Math.log(W[k])])
            }
        }
    }
    ),
    "./src/generation/stopping_criteria.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            EosTokenCriteria: () => C,
            InterruptableStoppingCriteria: () => M,
            MaxLengthCriteria: () => R,
            StoppingCriteria: () => h,
            StoppingCriteriaList: () => b
        });
        var l = e("./src/utils/generic.js");
        class h extends l.Callable {
            _call(L, _) {
                throw Error("StoppingCriteria needs to be subclassed")
            }
        }
        class b extends l.Callable {
            constructor() {
                super(),
                this.criteria = []
            }
            push(L) {
                this.criteria.push(L)
            }
            extend(L) {
                L instanceof b ? L = L.criteria : L instanceof h && (L = [L]),
                this.criteria.push(...L)
            }
            _call(L, _) {
                let a = new Array(L.length).fill(!1);
                for (let v of this.criteria) {
                    let g = v(L, _);
                    for (let y = 0; y < a.length; ++y)
                        a[y] ||= g[y]
                }
                return a
            }
            [Symbol.iterator]() {
                return this.criteria.values()
            }
        }
        class R extends h {
            constructor(L, _=null) {
                super(),
                this.max_length = L,
                this.max_position_embeddings = _
            }
            _call(L) {
                return L.map(_ => _.length >= this.max_length)
            }
        }
        class C extends h {
            constructor(L) {
                super(),
                Array.isArray(L) || (L = [L]),
                this.eos_token_id = L
            }
            _call(L, _) {
                return L.map(a => {
                    let v = a.at(-1);
                    return this.eos_token_id.some(g => v == g)
                }
                )
            }
        }
        class M extends h {
            constructor() {
                super(),
                this.interrupted = !1
            }
            interrupt() {
                this.interrupted = !0
            }
            reset() {
                this.interrupted = !1
            }
            _call(L, _) {
                return new Array(L.length).fill(this.interrupted)
            }
        }
    }
    ),
    "./src/generation/streamers.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            BaseStreamer: () => R,
            TextStreamer: () => M,
            WhisperTextStreamer: () => f
        });
        var l = e("./src/utils/core.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/env.js");
        class R {
            put(_) {
                throw Error("Not implemented")
            }
            end() {
                throw Error("Not implemented")
            }
        }
        let C = b.apis.IS_PROCESS_AVAILABLE ? L => __Process$.stdout.write(L) : L => console.log(L);
        class M extends R {
            constructor(_, {skip_prompt: a=!1, callback_function: v=null, token_callback_function: g=null, skip_special_tokens: y=!0, decode_kwargs: W={}, ...T}={}) {
                super(),
                this.tokenizer = _,
                this.skip_prompt = a,
                this.callback_function = v ?? C,
                this.token_callback_function = g,
                this.decode_kwargs = {
                    skip_special_tokens: y,
                    ...W,
                    ...T
                },
                this.token_cache = [],
                this.print_len = 0,
                this.next_tokens_are_prompt = !0
            }
            put(_) {
                if (_.length > 1)
                    throw Error("TextStreamer only supports batch size of 1");
                let a = this.next_tokens_are_prompt;
                if (a && (this.next_tokens_are_prompt = !1,
                this.skip_prompt))
                    return;
                let v = _[0];
                this.token_callback_function?.(v),
                this.token_cache = (0,
                l.mergeArrays)(this.token_cache, v);
                let g = this.tokenizer.decode(this.token_cache, this.decode_kwargs), y;
                a || g.endsWith(`
`) ? (y = g.slice(this.print_len),
                this.token_cache = [],
                this.print_len = 0) : g.length > 0 && (0,
                h.is_chinese_char)(g.charCodeAt(g.length - 1)) ? (y = g.slice(this.print_len),
                this.print_len += y.length) : (y = g.slice(this.print_len, g.lastIndexOf(" ") + 1),
                this.print_len += y.length),
                this.on_finalized_text(y, !1)
            }
            end() {
                let _;
                this.token_cache.length > 0 ? (_ = this.tokenizer.decode(this.token_cache, this.decode_kwargs).slice(this.print_len),
                this.token_cache = [],
                this.print_len = 0) : _ = "",
                this.next_tokens_are_prompt = !0,
                this.on_finalized_text(_, !0)
            }
            on_finalized_text(_, a) {
                _.length > 0 && this.callback_function?.(_),
                a && this.callback_function === C && b.apis.IS_PROCESS_AVAILABLE && this.callback_function?.(`
`)
            }
        }
        class f extends M {
            constructor(_, {skip_prompt: a=!1, callback_function: v=null, token_callback_function: g=null, on_chunk_start: y=null, on_chunk_end: W=null, on_finalize: T=null, time_precision: k=.02, skip_special_tokens: I=!0, decode_kwargs: p={}}={}) {
                super(_, {
                    skip_prompt: a,
                    skip_special_tokens: I,
                    callback_function: v,
                    token_callback_function: g,
                    decode_kwargs: p
                }),
                this.timestamp_begin = _.timestamp_begin,
                this.on_chunk_start = y,
                this.on_chunk_end = W,
                this.on_finalize = T,
                this.time_precision = k,
                this.waiting_for_timestamp = !1
            }
            put(_) {
                if (_.length > 1)
                    throw Error("WhisperTextStreamer only supports batch size of 1");
                let a = _[0];
                if (a.length === 1) {
                    let v = Number(a[0]) - this.timestamp_begin;
                    if (v >= 0) {
                        let g = v * this.time_precision;
                        this.waiting_for_timestamp ? this.on_chunk_end?.(g) : this.on_chunk_start?.(g),
                        this.waiting_for_timestamp = !this.waiting_for_timestamp,
                        this.token_callback_function?.(a);
                        return
                    }
                }
                return super.put(_)
            }
            end() {
                super.end(),
                this.on_finalize?.()
            }
        }
    }
    ),
    "./src/models.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ASTForAudioClassification: () => Ba,
            ASTModel: () => Oa,
            ASTPreTrainedModel: () => Sr,
            AlbertForMaskedLM: () => Ne,
            AlbertForQuestionAnswering: () => je,
            AlbertForSequenceClassification: () => Be,
            AlbertModel: () => ge,
            AlbertPreTrainedModel: () => ne,
            ArceeForCausalLM: () => An,
            ArceeModel: () => Ln,
            ArceePreTrainedModel: () => Hr,
            AutoModel: () => Yd,
            AutoModelForAudioClassification: () => hu,
            AutoModelForAudioFrameClassification: () => gu,
            AutoModelForAudioTextToText: () => ku,
            AutoModelForCTC: () => Mu,
            AutoModelForCausalLM: () => ou,
            AutoModelForDepthEstimation: () => bu,
            AutoModelForDocumentQuestionAnswering: () => Pu,
            AutoModelForImageClassification: () => lu,
            AutoModelForImageFeatureExtraction: () => Eu,
            AutoModelForImageMatting: () => Tu,
            AutoModelForImageSegmentation: () => cu,
            AutoModelForImageTextToText: () => Fu,
            AutoModelForImageToImage: () => wu,
            AutoModelForMaskGeneration: () => mu,
            AutoModelForMaskedLM: () => au,
            AutoModelForNormalEstimation: () => xu,
            AutoModelForObjectDetection: () => uu,
            AutoModelForPoseEstimation: () => vu,
            AutoModelForQuestionAnswering: () => nu,
            AutoModelForSemanticSegmentation: () => _u,
            AutoModelForSeq2SeqLM: () => eu,
            AutoModelForSequenceClassification: () => qd,
            AutoModelForSpeechSeq2Seq: () => tu,
            AutoModelForTextToSpectrogram: () => su,
            AutoModelForTextToWaveform: () => ru,
            AutoModelForTokenClassification: () => Zd,
            AutoModelForUniversalSegmentation: () => du,
            AutoModelForVision2Seq: () => iu,
            AutoModelForXVector: () => fu,
            AutoModelForZeroShotObjectDetection: () => pu,
            BartForConditionalGeneration: () => Fs,
            BartForSequenceClassification: () => xt,
            BartModel: () => Xt,
            BartPretrainedModel: () => fs,
            BaseModelOutput: () => _e,
            BeitForImageClassification: () => Zi,
            BeitModel: () => qi,
            BeitPreTrainedModel: () => So,
            BertForMaskedLM: () => re,
            BertForQuestionAnswering: () => Te,
            BertForSequenceClassification: () => pe,
            BertForTokenClassification: () => se,
            BertModel: () => Me,
            BertPreTrainedModel: () => ue,
            BlenderbotForConditionalGeneration: () => At,
            BlenderbotModel: () => zt,
            BlenderbotPreTrainedModel: () => ls,
            BlenderbotSmallForConditionalGeneration: () => ts,
            BlenderbotSmallModel: () => Dt,
            BlenderbotSmallPreTrainedModel: () => yt,
            BloomForCausalLM: () => wi,
            BloomModel: () => Ti,
            BloomPreTrainedModel: () => fo,
            CLIPModel: () => Ja,
            CLIPPreTrainedModel: () => Bs,
            CLIPSegForImageSegmentation: () => cn,
            CLIPSegModel: () => ln,
            CLIPSegPreTrainedModel: () => Vr,
            CLIPTextModel: () => Bd,
            CLIPTextModelWithProjection: () => Ya,
            CLIPVisionModel: () => jd,
            CLIPVisionModelWithProjection: () => qa,
            CamembertForMaskedLM: () => Qe,
            CamembertForQuestionAnswering: () => ct,
            CamembertForSequenceClassification: () => Oe,
            CamembertForTokenClassification: () => lt,
            CamembertModel: () => Ue,
            CamembertPreTrainedModel: () => fe,
            CausalLMOutput: () => Cs,
            CausalLMOutputWithPast: () => Su,
            ChineseCLIPModel: () => rn,
            ChineseCLIPPreTrainedModel: () => sn,
            ClapAudioModelWithProjection: () => u_,
            ClapModel: () => __,
            ClapPreTrainedModel: () => hr,
            ClapTextModelWithProjection: () => d_,
            CodeGenForCausalLM: () => xn,
            CodeGenModel: () => bn,
            CodeGenPreTrainedModel: () => $r,
            CohereForCausalLM: () => Zn,
            CohereModel: () => qn,
            CoherePreTrainedModel: () => no,
            ConvBertForMaskedLM: () => Ye,
            ConvBertForQuestionAnswering: () => As,
            ConvBertForSequenceClassification: () => Ls,
            ConvBertForTokenClassification: () => nt,
            ConvBertModel: () => Ws,
            ConvBertPreTrainedModel: () => ds,
            ConvNextForImageClassification: () => Ql,
            ConvNextModel: () => $l,
            ConvNextPreTrainedModel: () => Uo,
            ConvNextV2ForImageClassification: () => Hl,
            ConvNextV2Model: () => Xl,
            ConvNextV2PreTrainedModel: () => Ko,
            DFineForObjectDetection: () => ul,
            DFineModel: () => dl,
            DFinePreTrainedModel: () => Oo,
            DINOv3ConvNextModel: () => rc,
            DINOv3ConvNextPreTrainedModel: () => sc,
            DINOv3ViTModel: () => tc,
            DINOv3ViTPreTrainedModel: () => ec,
            DPTForDepthEstimation: () => Cl,
            DPTModel: () => kl,
            DPTPreTrainedModel: () => zo,
            DacDecoderModel: () => ed,
            DacDecoderOutput: () => Y_,
            DacEncoderModel: () => Z_,
            DacEncoderOutput: () => J_,
            DacModel: () => q_,
            DacPreTrainedModel: () => xr,
            DebertaForMaskedLM: () => es,
            DebertaForQuestionAnswering: () => Bt,
            DebertaForSequenceClassification: () => ss,
            DebertaForTokenClassification: () => Jt,
            DebertaModel: () => ft,
            DebertaPreTrainedModel: () => St,
            DebertaV2ForMaskedLM: () => Ts,
            DebertaV2ForQuestionAnswering: () => ws,
            DebertaV2ForSequenceClassification: () => hs,
            DebertaV2ForTokenClassification: () => ys,
            DebertaV2Model: () => Ps,
            DebertaV2PreTrainedModel: () => rs,
            DecisionTransformerModel: () => D_,
            DecisionTransformerPreTrainedModel: () => y_,
            DeiTForImageClassification: () => fl,
            DeiTModel: () => hl,
            DeiTPreTrainedModel: () => jo,
            DepthAnythingForDepthEstimation: () => Ll,
            DepthAnythingPreTrainedModel: () => Sl,
            DepthProForDepthEstimation: () => Ol,
            DepthProPreTrainedModel: () => Il,
            DetrForObjectDetection: () => tl,
            DetrForSegmentation: () => Lo,
            DetrModel: () => el,
            DetrObjectDetectionOutput: () => Ao,
            DetrPreTrainedModel: () => cr,
            DetrSegmentationOutput: () => sl,
            Dinov2ForImageClassification: () => Yl,
            Dinov2Model: () => Jl,
            Dinov2PreTrainedModel: () => $o,
            Dinov2WithRegistersForImageClassification: () => Zl,
            Dinov2WithRegistersModel: () => ql,
            Dinov2WithRegistersPreTrainedModel: () => Qo,
            DistilBertForMaskedLM: () => xs,
            DistilBertForQuestionAnswering: () => bs,
            DistilBertForSequenceClassification: () => ps,
            DistilBertForTokenClassification: () => Ds,
            DistilBertModel: () => us,
            DistilBertPreTrainedModel: () => os,
            DonutSwinModel: () => Kl,
            DonutSwinPreTrainedModel: () => Ul,
            EdgeTamModel: () => mc,
            EfficientNetForImageClassification: () => P_,
            EfficientNetModel: () => g_,
            EfficientNetPreTrainedModel: () => aa,
            ElectraForMaskedLM: () => w,
            ElectraForQuestionAnswering: () => ie,
            ElectraForSequenceClassification: () => O,
            ElectraForTokenClassification: () => K,
            ElectraModel: () => B,
            ElectraPreTrainedModel: () => n,
            Ernie4_5_ForCausalLM: () => a_,
            Ernie4_5_Model: () => o_,
            Ernie4_5_PretrainedModel: () => ea,
            EsmForMaskedLM: () => Is,
            EsmForSequenceClassification: () => Yt,
            EsmForTokenClassification: () => Fe,
            EsmModel: () => vs,
            EsmPreTrainedModel: () => as,
            ExaoneForCausalLM: () => zn,
            ExaoneModel: () => Rn,
            ExaonePreTrainedModel: () => eo,
            FalconForCausalLM: () => c_,
            FalconModel: () => l_,
            FalconPreTrainedModel: () => sa,
            FastViTForImageClassification: () => zi,
            FastViTModel: () => Ri,
            FastViTPreTrainedModel: () => vo,
            Florence2ForConditionalGeneration: () => Wa,
            Florence2PreTrainedModel: () => Ga,
            GLPNForDepthEstimation: () => Wl,
            GLPNModel: () => Gl,
            GLPNPreTrainedModel: () => Wo,
            GPT2LMHeadModel: () => dn,
            GPT2Model: () => _n,
            GPT2PreTrainedModel: () => Rr,
            GPTBigCodeForCausalLM: () => wn,
            GPTBigCodeModel: () => Tn,
            GPTBigCodePreTrainedModel: () => Kr,
            GPTJForCausalLM: () => Pn,
            GPTJModel: () => gn,
            GPTJPreTrainedModel: () => Ur,
            GPTNeoForCausalLM: () => Mn,
            GPTNeoModel: () => mn,
            GPTNeoPreTrainedModel: () => Gr,
            GPTNeoXForCausalLM: () => fn,
            GPTNeoXModel: () => hn,
            GPTNeoXPreTrainedModel: () => Wr,
            Gemma2ForCausalLM: () => ri,
            Gemma2Model: () => si,
            Gemma2PreTrainedModel: () => lo,
            Gemma3ForCausalLM: () => ii,
            Gemma3Model: () => ni,
            Gemma3PreTrainedModel: () => _o,
            Gemma3nForConditionalGeneration: () => Or,
            Gemma3nPreTrainedModel: () => Qa,
            GemmaForCausalLM: () => ti,
            GemmaModel: () => ei,
            GemmaPreTrainedModel: () => io,
            GlmForCausalLM: () => Vn,
            GlmModel: () => Nn,
            GlmPreTrainedModel: () => Zr,
            GraniteForCausalLM: () => Hn,
            GraniteModel: () => Xn,
            GraniteMoeHybridForCausalLM: () => Yn,
            GraniteMoeHybridModel: () => Jn,
            GraniteMoeHybridPreTrainedModel: () => ao,
            GranitePreTrainedModel: () => oo,
            GroundingDinoForObjectDetection: () => ac,
            GroundingDinoPreTrainedModel: () => oc,
            GroupViTModel: () => Vi,
            GroupViTPreTrainedModel: () => Ni,
            HeliumForCausalLM: () => jn,
            HeliumModel: () => Bn,
            HeliumPreTrainedModel: () => qr,
            HieraForImageClassification: () => Pl,
            HieraModel: () => gl,
            HieraPreTrainedModel: () => No,
            HubertForCTC: () => zc,
            HubertForSequenceClassification: () => Gc,
            HubertModel: () => Rc,
            HubertPreTrainedModel: () => Nd,
            IJepaForImageClassification: () => Si,
            IJepaModel: () => Ci,
            IJepaPreTrainedModel: () => wo,
            Idefics3ForConditionalGeneration: () => ir,
            Idefics3PreTrainedModel: () => Xa,
            ImageMattingOutput: () => Ad,
            JAISLMHeadModel: () => pn,
            JAISModel: () => un,
            JAISPreTrainedModel: () => zr,
            JinaCLIPModel: () => on,
            JinaCLIPPreTrainedModel: () => lr,
            JinaCLIPTextModel: () => an,
            JinaCLIPVisionModel: () => nn,
            Lfm2ForCausalLM: () => Dn,
            Lfm2Model: () => yn,
            Lfm2PreTrainedModel: () => Jr,
            LiteWhisperForConditionalGeneration: () => Na,
            Llama4ForCausalLM: () => kn,
            Llama4PreTrainedModel: () => Fn,
            LlamaForCausalLM: () => En,
            LlamaModel: () => vn,
            LlamaPreTrainedModel: () => Qr,
            LlavaForConditionalGeneration: () => nr,
            LlavaOnevisionForConditionalGeneration: () => Ra,
            LlavaPreTrainedModel: () => Ir,
            LlavaQwen2ForCausalLM: () => $a,
            LongT5ForConditionalGeneration: () => kt,
            LongT5Model: () => Vt,
            LongT5PreTrainedModel: () => bt,
            M2M100ForConditionalGeneration: () => Pc,
            M2M100Model: () => gc,
            M2M100PreTrainedModel: () => Jo,
            MBartForCausalLM: () => Qt,
            MBartForConditionalGeneration: () => ms,
            MBartForSequenceClassification: () => gs,
            MBartModel: () => qt,
            MBartPreTrainedModel: () => Lt,
            MPNetForMaskedLM: () => qs,
            MPNetForQuestionAnswering: () => or,
            MPNetForSequenceClassification: () => Zs,
            MPNetForTokenClassification: () => er,
            MPNetModel: () => Ys,
            MPNetPreTrainedModel: () => ns,
            MT5ForConditionalGeneration: () => is,
            MT5Model: () => Rt,
            MT5PreTrainedModel: () => Wt,
            MarianMTModel: () => fc,
            MarianModel: () => hc,
            MarianPreTrainedModel: () => Ho,
            MaskFormerForInstanceSegmentation: () => zl,
            MaskFormerModel: () => Rl,
            MaskFormerPreTrainedModel: () => Go,
            MaskedLMOutput: () => jt,
            Metric3DForDepthEstimation: () => jl,
            Metric3DPreTrainedModel: () => Bl,
            Metric3Dv2ForDepthEstimation: () => Vl,
            Metric3Dv2PreTrainedModel: () => Nl,
            MgpstrForSceneTextRecognition: () => N_,
            MgpstrModelOutput: () => B_,
            MgpstrPreTrainedModel: () => j_,
            MimiDecoderModel: () => H_,
            MimiDecoderOutput: () => $_,
            MimiEncoderModel: () => X_,
            MimiEncoderOutput: () => K_,
            MimiModel: () => Q_,
            MimiPreTrainedModel: () => br,
            MistralForCausalLM: () => r_,
            MistralModel: () => s_,
            MistralPreTrainedModel: () => Zo,
            MobileBertForMaskedLM: () => wt,
            MobileBertForQuestionAnswering: () => Es,
            MobileBertForSequenceClassification: () => Os,
            MobileBertModel: () => Ke,
            MobileBertPreTrainedModel: () => ke,
            MobileLLMForCausalLM: () => Wn,
            MobileLLMModel: () => Gn,
            MobileLLMPreTrainedModel: () => to,
            MobileNetV1ForImageClassification: () => w_,
            MobileNetV1ForSemanticSegmentation: () => b_,
            MobileNetV1Model: () => T_,
            MobileNetV1PreTrainedModel: () => gr,
            MobileNetV2ForImageClassification: () => v_,
            MobileNetV2ForSemanticSegmentation: () => E_,
            MobileNetV2Model: () => x_,
            MobileNetV2PreTrainedModel: () => Pr,
            MobileNetV3ForImageClassification: () => k_,
            MobileNetV3ForSemanticSegmentation: () => C_,
            MobileNetV3Model: () => F_,
            MobileNetV3PreTrainedModel: () => Tr,
            MobileNetV4ForImageClassification: () => L_,
            MobileNetV4ForSemanticSegmentation: () => A_,
            MobileNetV4Model: () => S_,
            MobileNetV4PreTrainedModel: () => wr,
            MobileViTForImageClassification: () => Ki,
            MobileViTModel: () => Ui,
            MobileViTPreTrainedModel: () => Eo,
            MobileViTV2ForImageClassification: () => Qi,
            MobileViTV2Model: () => $i,
            MobileViTV2PreTrainedModel: () => Fo,
            ModelOutput: () => Y,
            ModernBertDecoderForCausalLM: () => ht,
            ModernBertDecoderModel: () => qe,
            ModernBertDecoderPreTrainedModel: () => st,
            ModernBertForMaskedLM: () => ze,
            ModernBertForSequenceClassification: () => Ze,
            ModernBertForTokenClassification: () => Ie,
            ModernBertModel: () => $e,
            ModernBertPreTrainedModel: () => Re,
            Moondream1ForConditionalGeneration: () => za,
            MoonshineForConditionalGeneration: () => Va,
            MoonshineModel: () => Od,
            MoonshinePreTrainedModel: () => yr,
            MptForCausalLM: () => xi,
            MptModel: () => bi,
            MptPreTrainedModel: () => go,
            MultiModalityCausalLM: () => O_,
            MultiModalityPreTrainedModel: () => I_,
            MusicgenForCausalLM: () => Gd,
            MusicgenForConditionalGeneration: () => ia,
            MusicgenModel: () => zd,
            MusicgenPreTrainedModel: () => na,
            NanoChatForCausalLM: () => Sn,
            NanoChatModel: () => Cn,
            NanoChatPreTrainedModel: () => Xr,
            NeoBertForMaskedLM: () => Pe,
            NeoBertForQuestionAnswering: () => Ve,
            NeoBertForSequenceClassification: () => Se,
            NeoBertForTokenClassification: () => De,
            NeoBertModel: () => ye,
            NeoBertPreTrainedModel: () => Ee,
            NomicBertModel: () => Zt,
            NomicBertPreTrainedModel: () => Kt,
            OPTForCausalLM: () => Ei,
            OPTModel: () => vi,
            OPTPreTrainedModel: () => Po,
            Olmo2ForCausalLM: () => Qn,
            Olmo2Model: () => $n,
            Olmo2PreTrainedModel: () => ro,
            OlmoForCausalLM: () => Kn,
            OlmoModel: () => Un,
            OlmoPreTrainedModel: () => so,
            OpenELMForCausalLM: () => ci,
            OpenELMModel: () => li,
            OpenELMPreTrainedModel: () => uo,
            OwlViTForObjectDetection: () => Hi,
            OwlViTModel: () => Xi,
            OwlViTPreTrainedModel: () => ko,
            Owlv2ForObjectDetection: () => Yi,
            Owlv2Model: () => Ji,
            Owlv2PreTrainedModel: () => Co,
            PaliGemmaForConditionalGeneration: () => Ka,
            PaliGemmaPreTrainedModel: () => Ua,
            ParakeetForCTC: () => Ec,
            ParakeetPreTrainedModel: () => vc,
            PatchTSMixerForPrediction: () => G_,
            PatchTSMixerModel: () => z_,
            PatchTSMixerPreTrainedModel: () => ca,
            PatchTSTForPrediction: () => R_,
            PatchTSTModel: () => V_,
            PatchTSTPreTrainedModel: () => la,
            Phi3ForCausalLM: () => Pi,
            Phi3Model: () => gi,
            Phi3PreTrainedModel: () => ho,
            Phi3VForCausalLM: () => jr,
            Phi3VPreTrainedModel: () => Ha,
            PhiForCausalLM: () => fi,
            PhiModel: () => hi,
            PhiPreTrainedModel: () => Mo,
            PreTrainedModel: () => c,
            PretrainedMixin: () => mt,
            PvtForImageClassification: () => Di,
            PvtModel: () => yi,
            PvtPreTrainedModel: () => bo,
            PyAnnoteForAudioFrameClassification: () => kc,
            PyAnnoteModel: () => Fc,
            PyAnnotePreTrainedModel: () => Yo,
            QuestionAnsweringModelOutput: () => Ut,
            Qwen2ForCausalLM: () => di,
            Qwen2Model: () => _i,
            Qwen2PreTrainedModel: () => po,
            Qwen2VLForConditionalGeneration: () => Mi,
            Qwen2VLPreTrainedModel: () => mi,
            Qwen3ForCausalLM: () => pi,
            Qwen3Model: () => ui,
            Qwen3PreTrainedModel: () => mo,
            RFDetrForObjectDetection: () => cl,
            RFDetrModel: () => ll,
            RFDetrObjectDetectionOutput: () => _l,
            RFDetrPreTrainedModel: () => Io,
            RTDetrForObjectDetection: () => ol,
            RTDetrModel: () => rl,
            RTDetrObjectDetectionOutput: () => tr,
            RTDetrPreTrainedModel: () => yo,
            RTDetrV2ForObjectDetection: () => nl,
            RTDetrV2Model: () => al,
            RTDetrV2ObjectDetectionOutput: () => il,
            RTDetrV2PreTrainedModel: () => Do,
            ResNetForImageClassification: () => wl,
            ResNetModel: () => Tl,
            ResNetPreTrainedModel: () => Vo,
            RoFormerForMaskedLM: () => $t,
            RoFormerForQuestionAnswering: () => Gs,
            RoFormerForSequenceClassification: () => Rs,
            RoFormerForTokenClassification: () => zs,
            RoFormerModel: () => Ft,
            RoFormerPreTrainedModel: () => Gt,
            RobertaForMaskedLM: () => wa,
            RobertaForQuestionAnswering: () => va,
            RobertaForSequenceClassification: () => ba,
            RobertaForTokenClassification: () => xa,
            RobertaModel: () => ar,
            RobertaPreTrainedModel: () => Ms,
            Sam2ImageSegmentationOutput: () => uc,
            Sam2Model: () => ur,
            Sam2PreTrainedModel: () => pc,
            Sam3TrackerModel: () => Mc,
            SamImageSegmentationOutput: () => dc,
            SamModel: () => _c,
            SamPreTrainedModel: () => cc,
            SapiensForDepthEstimation: () => yl,
            SapiensForNormalEstimation: () => Dl,
            SapiensForSemanticSegmentation: () => Al,
            SapiensPreTrainedModel: () => dr,
            SegformerForImageClassification: () => m_,
            SegformerForSemanticSegmentation: () => M_,
            SegformerModel: () => Rd,
            SegformerPreTrainedModel: () => fr,
            Seq2SeqLMOutput: () => Cu,
            SequenceClassifierOutput: () => rt,
            SiglipModel: () => Za,
            SiglipPreTrainedModel: () => Nr,
            SiglipTextModel: () => en,
            SiglipVisionModel: () => tn,
            SmolLM3ForCausalLM: () => On,
            SmolLM3Model: () => In,
            SmolLM3PreTrainedModel: () => Yr,
            SmolVLMForConditionalGeneration: () => Br,
            SnacDecoderModel: () => rd,
            SnacEncoderModel: () => sd,
            SnacModel: () => td,
            SnacPreTrainedModel: () => vr,
            SpeechT5ForSpeechToText: () => Jc,
            SpeechT5ForTextToSpeech: () => Yc,
            SpeechT5HifiGan: () => qc,
            SpeechT5Model: () => Vd,
            SpeechT5PreTrainedModel: () => Mr,
            SqueezeBertForMaskedLM: () => F,
            SqueezeBertForQuestionAnswering: () => G,
            SqueezeBertForSequenceClassification: () => z,
            SqueezeBertModel: () => i,
            SqueezeBertPreTrainedModel: () => q,
            StableLmForCausalLM: () => f_,
            StableLmModel: () => h_,
            StableLmPreTrainedModel: () => oa,
            Starcoder2ForCausalLM: () => i_,
            Starcoder2Model: () => n_,
            Starcoder2PreTrainedModel: () => ta,
            StyleTextToSpeech2Model: () => Hc,
            StyleTextToSpeech2PreTrainedModel: () => Xc,
            SupertonicForConditionalGeneration: () => qo,
            SupertonicPreTrainedModel: () => Zc,
            Swin2SRForImageSuperResolution: () => Fl,
            Swin2SRModel: () => El,
            Swin2SRPreTrainedModel: () => Ro,
            SwinForImageClassification: () => xl,
            SwinForSemanticSegmentation: () => vl,
            SwinModel: () => bl,
            SwinPreTrainedModel: () => _r,
            T5ForConditionalGeneration: () => ot,
            T5Model: () => _t,
            T5PreTrainedModel: () => Le,
            TableTransformerForObjectDetection: () => ml,
            TableTransformerModel: () => pl,
            TableTransformerObjectDetectionOutput: () => Ml,
            TableTransformerPreTrainedModel: () => Bo,
            TokenClassifierOutput: () => It,
            TrOCRForCausalLM: () => t_,
            TrOCRPreTrainedModel: () => e_,
            UltravoxModel: () => _a,
            UltravoxPreTrainedModel: () => W_,
            UniSpeechForCTC: () => Ac,
            UniSpeechForSequenceClassification: () => yc,
            UniSpeechModel: () => Lc,
            UniSpeechPreTrainedModel: () => pr,
            UniSpeechSatForAudioFrameClassification: () => Bc,
            UniSpeechSatForCTC: () => Ic,
            UniSpeechSatForSequenceClassification: () => Oc,
            UniSpeechSatModel: () => Dc,
            UniSpeechSatPreTrainedModel: () => sr,
            VaultGemmaForCausalLM: () => ai,
            VaultGemmaModel: () => oi,
            VaultGemmaPreTrainedModel: () => co,
            ViTForImageClassification: () => ki,
            ViTMAEModel: () => Oi,
            ViTMAEPreTrainedModel: () => Ii,
            ViTMSNForImageClassification: () => ji,
            ViTMSNModel: () => Bi,
            ViTMSNPreTrainedModel: () => xo,
            ViTModel: () => Fi,
            ViTPreTrainedModel: () => To,
            VisionEncoderDecoderModel: () => Dr,
            VitMatteForImageMatting: () => Wi,
            VitMattePreTrainedModel: () => Gi,
            VitPoseForPoseEstimation: () => Ai,
            VitPosePreTrainedModel: () => Li,
            VitsModel: () => ra,
            VitsModelOutput: () => yd,
            VitsPreTrainedModel: () => p_,
            VoxtralForConditionalGeneration: () => U_,
            Wav2Vec2BertForCTC: () => Nc,
            Wav2Vec2BertForSequenceClassification: () => Vc,
            Wav2Vec2BertModel: () => jc,
            Wav2Vec2BertPreTrainedModel: () => mr,
            Wav2Vec2ForAudioFrameClassification: () => xc,
            Wav2Vec2ForCTC: () => wc,
            Wav2Vec2ForSequenceClassification: () => bc,
            Wav2Vec2Model: () => Tc,
            Wav2Vec2PreTrainedModel: () => ks,
            WavLMForAudioFrameClassification: () => Qc,
            WavLMForCTC: () => Uc,
            WavLMForSequenceClassification: () => Kc,
            WavLMForXVector: () => $c,
            WavLMModel: () => Wc,
            WavLMPreTrainedModel: () => $s,
            WeSpeakerResNetModel: () => Sc,
            WeSpeakerResNetPreTrainedModel: () => Cc,
            WhisperForConditionalGeneration: () => Ar,
            WhisperModel: () => ja,
            WhisperPreTrainedModel: () => Lr,
            XLMForQuestionAnswering: () => Sa,
            XLMForSequenceClassification: () => ka,
            XLMForTokenClassification: () => Ca,
            XLMModel: () => Ea,
            XLMPreTrainedModel: () => Us,
            XLMRobertaForMaskedLM: () => Aa,
            XLMRobertaForQuestionAnswering: () => Ia,
            XLMRobertaForSequenceClassification: () => ya,
            XLMRobertaForTokenClassification: () => Da,
            XLMRobertaModel: () => La,
            XLMRobertaPreTrainedModel: () => Ks,
            XLMWithLMHeadModel: () => Fa,
            XVectorOutput: () => Ld,
            YolosForObjectDetection: () => ic,
            YolosModel: () => nc,
            YolosObjectDetectionOutput: () => lc,
            YolosPreTrainedModel: () => Xo
        });
        var l = e("./src/configs.js")
          , h = e("./src/backends/onnx.js")
          , b = e("./src/utils/dtypes.js")
          , R = e("./src/utils/generic.js")
          , C = e("./src/utils/core.js")
          , M = e("./src/utils/hub.js")
          , f = e("./src/utils/constants.js")
          , L = e("./src/generation/logits_process.js")
          , _ = e("./src/generation/configuration_utils.js")
          , a = e("./src/utils/tensor.js")
          , v = e("./src/utils/image.js")
          , g = e("./src/utils/maths.js")
          , y = e("./src/generation/stopping_criteria.js")
          , W = e("./src/generation/logits_sampler.js")
          , T = e("./src/env.js")
          , k = e("./src/models/whisper/generation_whisper.js")
          , I = e("./src/models/whisper/common_whisper.js");
        let p = {
            EncoderOnly: 0,
            EncoderDecoder: 1,
            Seq2Seq: 2,
            Vision2Seq: 3,
            DecoderOnly: 4,
            MaskGeneration: 5,
            ImageTextToText: 6,
            Musicgen: 7,
            MultiModality: 8,
            Phi3V: 9,
            AudioTextToText: 10,
            AutoEncoder: 11,
            ImageAudioTextToText: 12,
            Supertonic: 13
        }
          , m = new Map
          , E = new Map
          , o = new Map;
        async function d(s, r, P) {
            let X = P.config?.["transformers.js_config"] ?? {}
              , te = P.device ?? X.device;
            te && typeof te != "string" && (te.hasOwnProperty(r) ? te = te[r] : (console.warn(`device not specified for "${r}". Using the default device.`),
            te = null));
            let oe = te ?? (T.apis.IS_NODE_ENV ? "cpu" : "wasm")
              , me = (0,
            h.deviceToExecutionProviders)(oe)
              , ve = X.device_config ?? {};
            ve.hasOwnProperty(oe) && (X = {
                ...X,
                ...ve[oe]
            });
            let Ce = P.dtype ?? X.dtype;
            if (typeof Ce != "string" && (Ce && Ce.hasOwnProperty(r) ? Ce = Ce[r] : (Ce = b.DEFAULT_DEVICE_DTYPE_MAPPING[oe] ?? b.DATA_TYPES.fp32,
            console.warn(`dtype not specified for "${r}". Using the default dtype (${Ce}) for this device (${oe}).`))),
            Ce === b.DATA_TYPES.auto) {
                let it = X.dtype;
                typeof it != "string" && (it = it?.[r]),
                it && it !== b.DATA_TYPES.auto && b.DATA_TYPES.hasOwnProperty(it) ? Ce = it : Ce = b.DEFAULT_DEVICE_DTYPE_MAPPING[oe] ?? b.DATA_TYPES.fp32
            }
            let Ge = Ce;
            if (b.DEFAULT_DTYPE_SUFFIX_MAPPING.hasOwnProperty(Ge)) {
                if (Ge === b.DATA_TYPES.fp16 && oe === "webgpu" && !await (0,
                b.isWebGpuFp16Supported)())
                    throw new Error(`The device (${oe}) does not support fp16.`)
            } else
                throw new Error(`Invalid dtype: ${Ge}. Should be one of: ${Object.keys(b.DATA_TYPES).join(", ")}`);
            let et = X.kv_cache_dtype
              , tt = et ? typeof et == "string" ? et : et[Ge] ?? "float32" : void 0;
            if (tt && !["float32", "float16"].includes(tt))
                throw new Error(`Invalid kv_cache_dtype: ${tt}. Should be one of: float32, float16`);
            let at = {
                dtype: Ge,
                kv_cache_dtype: tt,
                device: oe
            }
              , He = b.DEFAULT_DTYPE_SUFFIX_MAPPING[Ge]
              , ut = `${r}${He}.onnx`
              , Je = `${P.subfolder ?? ""}/${ut}`
              , Xe = {
                ...P.session_options
            };
            Xe.executionProviders ??= me;
            let dt = X.free_dimension_overrides;
            dt ? Xe.freeDimensionOverrides ??= dt : oe.startsWith("webnn") && !Xe.freeDimensionOverrides && console.warn(`WebNN does not currently support dynamic shapes and requires 'free_dimension_overrides' to be set in config.json, preferably as a field within config["transformers.js_config"]["device_config"]["${oe}"]. When 'free_dimension_overrides' is not set, you may experience significant performance degradation.`);
            let Mt = T.apis.IS_NODE_ENV && T.env.useFSCache
              , gt = (0,
            M.getModelFile)(s, Je, !0, P, Mt)
              , Tt = P.use_external_data_format ?? X.use_external_data_format
              , Et = [];
            if (Tt) {
                let it;
                typeof Tt == "object" ? Tt.hasOwnProperty(ut) ? it = Tt[ut] : Tt.hasOwnProperty(r) ? it = Tt[r] : it = !1 : it = Tt;
                let vt = +it;
                if (vt > M.MAX_EXTERNAL_DATA_CHUNKS)
                    throw new Error(`The number of external data chunks (${vt}) exceeds the maximum allowed value (${M.MAX_EXTERNAL_DATA_CHUNKS}).`);
                for (let Nt = 0; Nt < vt; ++Nt) {
                    let js = `${ut}_data${Nt === 0 ? "" : "_" + Nt}`
                      , Ht = `${P.subfolder ?? ""}/${js}`;
                    Et.push(new Promise(async (cs, Xs) => {
                        let Hs = await (0,
                        M.getModelFile)(s, Ht, !0, P, Mt);
                        cs(Hs instanceof Uint8Array ? {
                            path: js,
                            data: Hs
                        } : js)
                    }
                    ))
                }
            } else
                Xe.externalData !== void 0 && (Et = Xe.externalData.map(async it => {
                    if (typeof it.data == "string") {
                        let vt = await (0,
                        M.getModelFile)(s, it.data, !0, P);
                        return {
                            ...it,
                            data: vt
                        }
                    }
                    return it
                }
                ));
            if (Et.length > 0) {
                let it = await Promise.all(Et);
                T.apis.IS_NODE_ENV || (Xe.externalData = it)
            }
            if (oe === "webgpu") {
                let it = (0,
                l.getCacheShapes)(P.config, {
                    prefix: "present"
                });
                if (Object.keys(it).length > 0 && !(0,
                h.isONNXProxy)()) {
                    let vt = {};
                    for (let Nt in it)
                        vt[Nt] = "gpu-buffer";
                    Xe.preferredOutputLocation = vt
                }
            }
            return {
                buffer_or_path: await gt,
                session_options: Xe,
                session_config: at
            }
        }
        async function x(s, r, P) {
            return Object.fromEntries(await Promise.all(Object.keys(r).map(async X => {
                let {buffer_or_path: te, session_options: oe, session_config: me} = await d(s, r[X], P)
                  , ve = await (0,
                h.createInferenceSession)(te, oe, me);
                return [X, ve]
            }
            )))
        }
        async function S(s, r, P) {
            return Object.fromEntries(await Promise.all(Object.keys(r).map(async X => {
                let te = await (0,
                M.getModelJSON)(s, r[X], !1, P);
                return [X, te]
            }
            )))
        }
        function N(s, r) {
            let P = Object.create(null)
              , X = [];
            for (let me of s.inputNames) {
                let ve = r[me];
                if (!(ve instanceof a.Tensor)) {
                    X.push(me);
                    continue
                }
                P[me] = (0,
                h.isONNXProxy)() ? ve.clone() : ve
            }
            if (X.length > 0)
                throw new Error(`An error occurred during model execution: "Missing the following inputs: ${X.join(", ")}.`);
            let te = Object.keys(r).length
              , oe = s.inputNames.length;
            if (te > oe) {
                let me = Object.keys(r).filter(ve => !s.inputNames.includes(ve));
                console.warn(`WARNING: Too many inputs were provided (${te} > ${oe}). The following inputs will be ignored: "${me.join(", ")}".`)
            }
            return P
        }
        async function j(s, r) {
            let P = N(s, r);
            try {
                let X = Object.fromEntries(Object.entries(P).map( ([oe,me]) => [oe, me.ort_tensor]))
                  , te = await (0,
                h.runInferenceSession)(s, X);
                return D(te)
            } catch (X) {
                let te = Object.fromEntries(Object.entries(P).map( ([oe,me]) => {
                    let ve = {
                        type: me.type,
                        dims: me.dims,
                        location: me.location
                    };
                    return ve.location !== "gpu-buffer" && (ve.data = me.data),
                    [oe, ve]
                }
                ));
                throw console.error(`An error occurred during model execution: "${X}".`),
                console.error("Inputs given to model:", te),
                X
            }
        }
        function D(s) {
            for (let r in s)
                (0,
                h.isONNXTensor)(s[r]) ? s[r] = new a.Tensor(s[r]) : typeof s[r] == "object" && D(s[r]);
            return s
        }
        function $(s) {
            if (s instanceof a.Tensor)
                return s;
            if (s.length === 0)
                throw Error("items must be non-empty");
            if (Array.isArray(s[0])) {
                if (s.some(r => r.length !== s[0].length))
                    throw Error("Unable to create tensor, you should probably activate truncation and/or padding with 'padding=True' and/or 'truncation=True' to have batched tensors with the same length.");
                return new a.Tensor("int64",BigInt64Array.from(s.flat().map(r => BigInt(r))),[s.length, s[0].length])
            } else
                return new a.Tensor("int64",BigInt64Array.from(s.map(r => BigInt(r))),[1, s.length])
        }
        function U(s) {
            return new a.Tensor("bool",[s],[1])
        }
        async function H(s, r) {
            let {encoder_outputs: P, input_ids: X, decoder_input_ids: te, ...oe} = r;
            if (!P) {
                let ve = (0,
                C.pick)(r, s.sessions.model.inputNames);
                P = (await Z(s, ve)).last_hidden_state
            }
            return oe.input_ids = te,
            oe.encoder_hidden_states = P,
            s.sessions.decoder_model_merged.inputNames.includes("encoder_attention_mask") && (oe.encoder_attention_mask = r.attention_mask),
            await le(s, oe, !0)
        }
        async function Z(s, r) {
            let P = s.sessions.model
              , X = (0,
            C.pick)(r, P.inputNames);
            if (P.inputNames.includes("inputs_embeds") && !X.inputs_embeds) {
                if (!r.input_ids)
                    throw new Error("Both `input_ids` and `inputs_embeds` are missing in the model inputs.");
                X.inputs_embeds = await s.encode_text({
                    input_ids: r.input_ids
                })
            }
            if (P.inputNames.includes("token_type_ids") && !X.token_type_ids) {
                if (!X.input_ids)
                    throw new Error("Both `input_ids` and `token_type_ids` are missing in the model inputs.");
                X.token_type_ids = (0,
                a.zeros_like)(X.input_ids)
            }
            if (P.inputNames.includes("pixel_mask") && !X.pixel_mask) {
                if (!X.pixel_values)
                    throw new Error("Both `pixel_values` and `pixel_mask` are missing in the model inputs.");
                let te = X.pixel_values.dims;
                X.pixel_mask = (0,
                a.ones)([te[0], te[2], te[3]])
            }
            return await j(P, X)
        }
        async function ee(s, r) {
            let P = await s.encode(r);
            return await s.decode(P)
        }
        async function le(s, r, P=!1) {
            let X = s.sessions[P ? "decoder_model_merged" : "model"]
              , {past_key_values: te, ...oe} = r;
            if (X.inputNames.includes("use_cache_branch") && (oe.use_cache_branch = U(!!te)),
            X.inputNames.includes("position_ids") && oe.attention_mask && !oe.position_ids) {
                let ve = ["paligemma", "gemma3_text", "gemma3"].includes(s.config.model_type) ? 1 : 0;
                oe.position_ids = xe(oe, te, ve)
            }
            s.addPastKeyValues(oe, te);
            let me = (0,
            C.pick)(oe, X.inputNames);
            return await j(X, me)
        }
        function we({modality_token_id: s, inputs_embeds: r, modality_features: P, input_ids: X, attention_mask: te}) {
            let oe = X.tolist().map(Ge => Ge.reduce( (et, tt, at) => (tt == s && et.push(at),
            et), []))
              , me = oe.reduce( (Ge, et) => Ge + et.length, 0)
              , ve = P.dims[0];
            if (me !== ve)
                throw new Error(`Number of tokens and features do not match: tokens: ${me}, features ${ve}`);
            let Ce = 0;
            for (let Ge = 0; Ge < oe.length; ++Ge) {
                let et = oe[Ge]
                  , tt = r[Ge];
                for (let at = 0; at < et.length; ++at)
                    tt[et[at]].data.set(P[Ce++].data)
            }
            return {
                inputs_embeds: r,
                attention_mask: te
            }
        }
        function ce({image_token_id: s, inputs_embeds: r, image_features: P, input_ids: X, attention_mask: te}) {
            return we({
                modality_token_id: s,
                inputs_embeds: r,
                modality_features: P,
                input_ids: X,
                attention_mask: te
            })
        }
        function Q({audio_token_id: s, inputs_embeds: r, audio_features: P, input_ids: X, attention_mask: te}) {
            return we({
                modality_token_id: s,
                inputs_embeds: r,
                modality_features: P,
                input_ids: X,
                attention_mask: te
            })
        }
        async function A(s, {encode_function: r, merge_function: P, modality_input_name: X, modality_output_name: te, input_ids: oe=null, attention_mask: me=null, position_ids: ve=null, inputs_embeds: Ce=null, past_key_values: Ge=null, generation_config: et=null, logits_processor: tt=null, ...at}) {
            let He = at[X];
            if (!Ce) {
                if (Ce = await s.encode_text({
                    input_ids: oe,
                    ...at
                }),
                He && oe.dims[1] !== 1) {
                    let Je = await r({
                        [X]: He,
                        ...at
                    });
                    ({inputs_embeds: Ce, attention_mask: me} = P({
                        [te]: Je,
                        inputs_embeds: Ce,
                        input_ids: oe,
                        attention_mask: me
                    }))
                } else if (Ge && He && oe.dims[1] === 1) {
                    let Je = oe.dims[1]
                      , Xe = Object.values(Ge)[0].dims.at(-2);
                    me = (0,
                    a.cat)([(0,
                    a.ones)([oe.dims[0], Xe]), me.slice(null, [me.dims[1] - Je, me.dims[1]])], 1)
                }
            }
            if (!ve && s.config.model_type === "qwen2_vl") {
                let {image_grid_thw: Je, video_grid_thw: Xe} = at;
                [ve] = s.get_rope_index(oe, Je, Xe, me)
            }
            return await le(s, {
                inputs_embeds: Ce,
                past_key_values: Ge,
                attention_mask: me,
                position_ids: ve,
                generation_config: et,
                logits_processor: tt
            }, !0)
        }
        async function V(s, r) {
            return await A(s, {
                ...r,
                modality_input_name: "audio_values",
                modality_output_name: "audio_features",
                encode_function: s.encode_audio.bind(s),
                merge_function: s._merge_input_ids_with_audio_features.bind(s)
            })
        }
        async function J(s, r) {
            return await A(s, {
                ...r,
                modality_input_name: "pixel_values",
                modality_output_name: "image_features",
                encode_function: s.encode_image.bind(s),
                merge_function: s._merge_input_ids_with_image_features.bind(s)
            })
        }
        function ae(s, r=0) {
            let[P,X] = s.dims
              , te = s.data
              , oe = new BigInt64Array(te.length);
            for (let me = 0; me < P; ++me) {
                let ve = me * X
                  , Ce = BigInt(r);
                for (let Ge = 0; Ge < X; ++Ge) {
                    let et = ve + Ge;
                    te[et] === 0n ? oe[et] = BigInt(1) : (oe[et] = Ce,
                    Ce += te[et])
                }
            }
            return {
                data: oe,
                dims: s.dims
            }
        }
        function xe(s, r=null, P=0) {
            let {input_ids: X, inputs_embeds: te, attention_mask: oe} = s
              , {data: me, dims: ve} = ae(oe, P)
              , Ce = new a.Tensor("int64",me,ve);
            if (r) {
                let Ge = -(X ?? te).dims.at(1);
                Ce = Ce.slice(null, [Ge, null])
            }
            return Ce
        }
        function be(s, r, P, X) {
            let te = P.past_key_values ? Object.values(P.past_key_values)[0].dims.at(-2) : 0;
            if (!P.attention_mask) {
                let oe;
                for (let me of ["input_ids", "inputs_embeds", "position_ids"])
                    if (P[me]) {
                        oe = P[me].dims;
                        break
                    }
                if (!oe)
                    throw new Error("attention_mask is not provided, and unable to infer its shape from model inputs.");
                P.attention_mask = (0,
                a.ones)([oe[0], te + oe[1]])
            }
            if (P.past_key_values) {
                let {input_ids: oe, attention_mask: me} = P;
                me && me.dims[1] > oe.dims[1] || te < oe.dims[1] && (P.input_ids = oe.slice(null, [te, null]))
            }
            return P
        }
        function Ae(s, r, P, X) {
            return P.past_key_values && (r = r.map(te => [te.at(-1)])),
            {
                ...P,
                decoder_input_ids: $(r)
            }
        }
        function We(s, ...r) {
            return s.config.is_encoder_decoder ? Ae(s, ...r) : be(s, ...r)
        }
        function he(s, r, P, X) {
            let te = !!P.past_key_values;
            return X.guidance_scale !== null && X.guidance_scale > 1 && (te ? P.input_ids = (0,
            a.cat)([P.input_ids, P.input_ids], 0) : (P.input_ids = (0,
            a.cat)([P.input_ids, (0,
            a.full_like)(P.input_ids, BigInt(X.pad_token_id))], 0),
            P.attention_mask = (0,
            a.cat)([P.attention_mask, (0,
            a.full_like)(P.attention_mask, 0n)], 0))),
            (te || !P.pixel_values) && (P.pixel_values = (0,
            a.full)([0, 0, 3, 384, 384], 1)),
            te && (P.images_seq_mask = new a.Tensor("bool",new Array(1).fill(!0).fill(!1, 0, 1),[1, 1]),
            P.images_emb_mask = new a.Tensor("bool",new Array(0).fill(!1),[1, 1, 0])),
            P
        }
        class c extends R.Callable {
            main_input_name = "input_ids";
            forward_params = ["input_ids", "attention_mask"];
            constructor(r, P, X) {
                super(),
                this.config = r,
                this.sessions = P,
                this.configs = X;
                let te = o.get(this.constructor)
                  , oe = m.get(te);
                switch (this.can_generate = !1,
                this._forward = null,
                this._prepare_inputs_for_generation = null,
                oe) {
                case p.DecoderOnly:
                    this.can_generate = !0,
                    this._forward = le,
                    this._prepare_inputs_for_generation = be;
                    break;
                case p.Seq2Seq:
                case p.Vision2Seq:
                case p.Musicgen:
                    this.can_generate = !0,
                    this._forward = H,
                    this._prepare_inputs_for_generation = Ae;
                    break;
                case p.EncoderDecoder:
                    this._forward = H;
                    break;
                case p.ImageTextToText:
                    this.can_generate = !0,
                    this._forward = J,
                    this._prepare_inputs_for_generation = We;
                    break;
                case p.AudioTextToText:
                    this.can_generate = !0,
                    this._forward = V,
                    this._prepare_inputs_for_generation = We;
                    break;
                case p.Phi3V:
                case p.ImageAudioTextToText:
                    this.can_generate = !0,
                    this._prepare_inputs_for_generation = We;
                    break;
                case p.MultiModality:
                    this.can_generate = !0,
                    this._prepare_inputs_for_generation = he;
                    break;
                case p.AutoEncoder:
                    this._forward = ee;
                    break;
                default:
                    this._forward = Z;
                    break
                }
                this.can_generate && this.forward_params.push("past_key_values"),
                this.custom_config = this.config["transformers.js_config"] ?? {}
            }
            async dispose() {
                let r = [];
                for (let P of Object.values(this.sessions))
                    P?.handler?.dispose && r.push(P.handler.dispose());
                return await Promise.all(r)
            }
            static async from_pretrained(r, {progress_callback: P=null, config: X=null, cache_dir: te=null, local_files_only: oe=!1, revision: me="main", model_file_name: ve=null, subfolder: Ce="onnx", device: Ge=null, dtype: et=null, use_external_data_format: tt=null, session_options: at={}}={}) {
                let He = {
                    progress_callback: P,
                    config: X,
                    cache_dir: te,
                    local_files_only: oe,
                    revision: me,
                    model_file_name: ve,
                    subfolder: Ce,
                    device: Ge,
                    dtype: et,
                    use_external_data_format: tt,
                    session_options: at
                }
                  , ut = o.get(this)
                  , Je = m.get(ut);
                X = He.config = await l.AutoConfig.from_pretrained(r, He);
                let Xe;
                if (Je === p.DecoderOnly)
                    Xe = await Promise.all([x(r, {
                        model: He.model_file_name ?? "model"
                    }, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)]);
                else if (Je === p.Seq2Seq || Je === p.Vision2Seq)
                    Xe = await Promise.all([x(r, {
                        model: "encoder_model",
                        decoder_model_merged: "decoder_model_merged"
                    }, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)]);
                else if (Je === p.MaskGeneration)
                    Xe = await Promise.all([x(r, {
                        model: "vision_encoder",
                        prompt_encoder_mask_decoder: "prompt_encoder_mask_decoder"
                    }, He)]);
                else if (Je === p.EncoderDecoder)
                    Xe = await Promise.all([x(r, {
                        model: "encoder_model",
                        decoder_model_merged: "decoder_model_merged"
                    }, He)]);
                else if (Je === p.ImageTextToText) {
                    let dt = {
                        embed_tokens: "embed_tokens",
                        vision_encoder: "vision_encoder",
                        decoder_model_merged: "decoder_model_merged"
                    };
                    X.is_encoder_decoder && (dt.model = "encoder_model"),
                    Xe = await Promise.all([x(r, dt, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)])
                } else if (Je === p.AudioTextToText) {
                    let dt = {
                        embed_tokens: "embed_tokens",
                        audio_encoder: "audio_encoder",
                        decoder_model_merged: "decoder_model_merged"
                    };
                    Xe = await Promise.all([x(r, dt, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)])
                } else if (Je === p.ImageAudioTextToText) {
                    let dt = {
                        embed_tokens: "embed_tokens",
                        audio_encoder: "audio_encoder",
                        vision_encoder: "vision_encoder",
                        decoder_model_merged: "decoder_model_merged"
                    };
                    Xe = await Promise.all([x(r, dt, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)])
                } else if (Je === p.Musicgen)
                    Xe = await Promise.all([x(r, {
                        model: "text_encoder",
                        decoder_model_merged: "decoder_model_merged",
                        encodec_decode: "encodec_decode"
                    }, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)]);
                else if (Je === p.MultiModality)
                    Xe = await Promise.all([x(r, {
                        prepare_inputs_embeds: "prepare_inputs_embeds",
                        model: "language_model",
                        lm_head: "lm_head",
                        gen_head: "gen_head",
                        gen_img_embeds: "gen_img_embeds",
                        image_decode: "image_decode"
                    }, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)]);
                else if (Je === p.Phi3V)
                    Xe = await Promise.all([x(r, {
                        prepare_inputs_embeds: "prepare_inputs_embeds",
                        model: "model",
                        vision_encoder: "vision_encoder"
                    }, He), S(r, {
                        generation_config: "generation_config.json"
                    }, He)]);
                else if (Je === p.AutoEncoder)
                    Xe = await Promise.all([x(r, {
                        encoder_model: "encoder_model",
                        decoder_model: "decoder_model"
                    }, He)]);
                else if (Je === p.Supertonic)
                    Xe = await Promise.all([x(r, {
                        text_encoder: "text_encoder",
                        latent_denoiser: "latent_denoiser",
                        voice_decoder: "voice_decoder"
                    }, He)]);
                else {
                    if (Je !== p.EncoderOnly) {
                        let dt = ut ?? X?.model_type;
                        dt !== "custom" && console.warn(`Model type for '${dt}' not found, assuming encoder-only architecture. Please report this at ${f.GITHUB_ISSUE_URL}.`)
                    }
                    Xe = await Promise.all([x(r, {
                        model: He.model_file_name ?? "model"
                    }, He)])
                }
                return new this(X,...Xe)
            }
            async _call(r) {
                return await this.forward(r)
            }
            async forward(r) {
                return await this._forward(this, r)
            }
            get generation_config() {
                return this.configs?.generation_config ?? null
            }
            _get_logits_processor(r, P, X=null) {
                let te = new L.LogitsProcessorList;
                if (r.repetition_penalty !== null && r.repetition_penalty !== 1 && te.push(new L.RepetitionPenaltyLogitsProcessor(r.repetition_penalty)),
                r.no_repeat_ngram_size !== null && r.no_repeat_ngram_size > 0 && te.push(new L.NoRepeatNGramLogitsProcessor(r.no_repeat_ngram_size)),
                r.bad_words_ids !== null && te.push(new L.NoBadWordsLogitsProcessor(r.bad_words_ids,r.eos_token_id)),
                r.min_length !== null && r.eos_token_id !== null && r.min_length > 0 && te.push(new L.MinLengthLogitsProcessor(r.min_length,r.eos_token_id)),
                r.min_new_tokens !== null && r.eos_token_id !== null && r.min_new_tokens > 0 && te.push(new L.MinNewTokensLengthLogitsProcessor(P,r.min_new_tokens,r.eos_token_id)),
                r.forced_bos_token_id !== null && te.push(new L.ForcedBOSTokenLogitsProcessor(r.forced_bos_token_id)),
                r.forced_eos_token_id !== null && te.push(new L.ForcedEOSTokenLogitsProcessor(r.max_length,r.forced_eos_token_id)),
                r.begin_suppress_tokens !== null) {
                    let oe = P > 1 || r.forced_bos_token_id === null ? P : P + 1;
                    te.push(new L.SuppressTokensAtBeginLogitsProcessor(r.begin_suppress_tokens,oe))
                }
                return r.guidance_scale !== null && r.guidance_scale > 1 && te.push(new L.ClassifierFreeGuidanceLogitsProcessor(r.guidance_scale)),
                r.temperature === 0 && r.do_sample && (console.warn("`do_sample` changed to false because `temperature: 0` implies greedy sampling (always selecting the most likely token), which is incompatible with `do_sample: true`."),
                r.do_sample = !1),
                r.do_sample && r.temperature !== null && r.temperature !== 1 && te.push(new L.TemperatureLogitsWarper(r.temperature)),
                X !== null && te.extend(X),
                te
            }
            _prepare_generation_config(r, P, X=_.GenerationConfig) {
                let te = {
                    ...this.config
                };
                for (let me of ["decoder", "generator", "text_config"])
                    me in te && Object.assign(te, te[me]);
                let oe = new X(te);
                return Object.assign(oe, this.generation_config ?? {}),
                r && Object.assign(oe, r),
                P && Object.assign(oe, (0,
                C.pick)(P, Object.getOwnPropertyNames(oe))),
                oe
            }
            _get_stopping_criteria(r, P=null) {
                let X = new y.StoppingCriteriaList;
                return r.max_length !== null && X.push(new y.MaxLengthCriteria(r.max_length,this.config.max_position_embeddings ?? null)),
                r.eos_token_id !== null && X.push(new y.EosTokenCriteria(r.eos_token_id)),
                P && X.extend(P),
                X
            }
            _validate_model_class() {
                if (!this.can_generate) {
                    let r = [pa, ma, ua, da]
                      , P = o.get(this.constructor)
                      , X = new Set
                      , te = this.config.model_type;
                    for (let me of r) {
                        let ve = me.get(te);
                        ve && X.add(ve[0])
                    }
                    let oe = `The current model class (${P}) is not compatible with \`.generate()\`, as it doesn't have a language model head.`;
                    throw X.size > 0 && (oe += ` Please use the following class instead: ${[...X].join(", ")}`),
                    Error(oe)
                }
            }
            prepare_inputs_for_generation(...r) {
                return this._prepare_inputs_for_generation(this, ...r)
            }
            _update_model_kwargs_for_generation({generated_input_ids: r, outputs: P, model_inputs: X, is_encoder_decoder: te}) {
                return X.past_key_values = this.getPastKeyValues(P, X.past_key_values),
                X.input_ids = new a.Tensor("int64",r.flat(),[r.length, 1]),
                te ? "decoder_attention_mask"in X : X.attention_mask = (0,
                a.cat)([X.attention_mask, (0,
                a.ones)([X.attention_mask.dims[0], 1])], 1),
                X.position_ids = null,
                X
            }
            _prepare_model_inputs({inputs: r, bos_token_id: P, model_kwargs: X}) {
                let te = (0,
                C.pick)(X, this.forward_params)
                  , oe = this.main_input_name;
                if (oe in te) {
                    if (r)
                        throw new Error("`inputs`: {inputs}` were passed alongside {input_name} which is not allowed. Make sure to either pass {inputs} or {input_name}=...")
                } else
                    te[oe] = r;
                return {
                    inputs_tensor: te[oe],
                    model_inputs: te,
                    model_input_name: oe
                }
            }
            async _prepare_encoder_decoder_kwargs_for_generation({inputs_tensor: r, model_inputs: P, model_input_name: X, generation_config: te}) {
                if (this.sessions.model.inputNames.includes("inputs_embeds") && !P.inputs_embeds && "_prepare_inputs_embeds"in this) {
                    let {input_ids: me, pixel_values: ve, attention_mask: Ce, ...Ge} = P
                      , et = await this._prepare_inputs_embeds(P);
                    P = {
                        ...Ge,
                        ...(0,
                        C.pick)(et, ["inputs_embeds", "attention_mask"])
                    }
                }
                let {last_hidden_state: oe} = await Z(this, P);
                if (te.guidance_scale !== null && te.guidance_scale > 1)
                    oe = (0,
                    a.cat)([oe, (0,
                    a.full_like)(oe, 0)], 0),
                    "attention_mask"in P && (P.attention_mask = (0,
                    a.cat)([P.attention_mask, (0,
                    a.zeros_like)(P.attention_mask)], 0));
                else if (P.decoder_input_ids) {
                    let me = $(P.decoder_input_ids).dims[0];
                    if (me !== oe.dims[0]) {
                        if (oe.dims[0] !== 1)
                            throw new Error(`The encoder outputs have a different batch size (${oe.dims[0]}) than the decoder inputs (${me}).`);
                        oe = (0,
                        a.cat)(Array.from({
                            length: me
                        }, () => oe), 0)
                    }
                }
                return P.encoder_outputs = oe,
                P
            }
            _prepare_decoder_input_ids_for_generation({batch_size: r, model_input_name: P, model_kwargs: X, decoder_start_token_id: te, bos_token_id: oe, generation_config: me}) {
                let {decoder_input_ids: ve, ...Ce} = X;
                if (!(ve instanceof a.Tensor)) {
                    if (ve)
                        Array.isArray(ve[0]) || (ve = Array.from({
                            length: r
                        }, () => ve));
                    else if (te ??= oe,
                    this.config.model_type === "musicgen")
                        ve = Array.from({
                            length: r * this.config.decoder.num_codebooks
                        }, () => [te]);
                    else if (Array.isArray(te)) {
                        if (te.length !== r)
                            throw new Error(`\`decoder_start_token_id\` expcted to have length ${r} but got ${te.length}`);
                        ve = te
                    } else
                        ve = Array.from({
                            length: r
                        }, () => [te]);
                    ve = $(ve)
                }
                return X.decoder_attention_mask = (0,
                a.ones_like)(ve),
                {
                    input_ids: ve,
                    model_inputs: Ce
                }
            }
            async generate({inputs: r=null, generation_config: P=null, logits_processor: X=null, stopping_criteria: te=null, streamer: oe=null, ...me}) {
                this._validate_model_class(),
                P = this._prepare_generation_config(P, me);
                let {inputs_tensor: ve, model_inputs: Ce, model_input_name: Ge} = this._prepare_model_inputs({
                    inputs: r,
                    model_kwargs: me
                })
                  , et = this.config.is_encoder_decoder;
                et && ("encoder_outputs"in Ce || (Ce = await this._prepare_encoder_decoder_kwargs_for_generation({
                    inputs_tensor: ve,
                    model_inputs: Ce,
                    model_input_name: Ge,
                    generation_config: P
                })));
                let tt;
                et ? {input_ids: tt, model_inputs: Ce} = this._prepare_decoder_input_ids_for_generation({
                    batch_size: Ce[Ge].dims.at(0),
                    model_input_name: Ge,
                    model_kwargs: Ce,
                    decoder_start_token_id: P.decoder_start_token_id,
                    bos_token_id: P.bos_token_id,
                    generation_config: P
                }) : tt = Ce[Ge];
                let at = tt.dims.at(-1);
                P.max_new_tokens !== null && (P.max_length = at + P.max_new_tokens);
                let He = this._get_logits_processor(P, at, X)
                  , ut = this._get_stopping_criteria(P, te)
                  , Je = Ce[Ge].dims.at(0)
                  , Xe = W.LogitsSampler.getSampler(P)
                  , dt = new Array(Je).fill(0)
                  , Mt = tt.tolist();
                oe && oe.put(Mt);
                let gt, Tt = {};
                for (; ; ) {
                    if (Ce = this.prepare_inputs_for_generation(Mt, Ce, P),
                    gt = await this.forward(Ce),
                    P.output_attentions && P.return_dict_in_generate) {
                        let Ht = this.getAttentions(gt);
                        for (let cs in Ht)
                            cs in Tt || (Tt[cs] = []),
                            Tt[cs].push(Ht[cs])
                    }
                    let it = gt.logits.slice(null, -1, null)
                      , vt = He(Mt, it)
                      , Nt = [];
                    for (let Ht = 0; Ht < vt.dims.at(0); ++Ht) {
                        let cs = vt[Ht]
                          , Xs = await Xe(cs);
                        for (let[Hs,Er] of Xs) {
                            let rr = BigInt(Hs);
                            dt[Ht] += Er,
                            Mt[Ht].push(rr),
                            Nt.push([rr]);
                            break
                        }
                    }
                    if (oe && oe.put(Nt),
                    ut(Mt).every(Ht => Ht))
                        break;
                    Ce = this._update_model_kwargs_for_generation({
                        generated_input_ids: Nt,
                        outputs: gt,
                        model_inputs: Ce,
                        is_encoder_decoder: et
                    })
                }
                oe && oe.end();
                let Et = this.getPastKeyValues(gt, Ce.past_key_values, !0)
                  , Ct = new a.Tensor("int64",Mt.flat(),[Mt.length, Mt[0].length]);
                if (P.return_dict_in_generate)
                    return {
                        sequences: Ct,
                        past_key_values: Et,
                        ...Tt
                    };
                for (let it of Object.values(gt))
                    it.location === "gpu-buffer" && it.dispose();
                return Ct
            }
            getPastKeyValues(r, P, X=!1) {
                let te = Object.create(null);
                for (let oe in r)
                    if (oe.startsWith("present")) {
                        let me = oe.replace("present_conv", "past_conv").replace("present", "past_key_values")
                          , ve = oe.includes("encoder");
                        if (ve && P ? te[me] = P[me] : te[me] = r[oe],
                        P && (!ve || X)) {
                            let Ce = P[me];
                            Ce.location === "gpu-buffer" && Ce.dispose()
                        }
                    }
                return te
            }
            getAttentions(r) {
                let P = {};
                for (let X of ["cross_attentions", "encoder_attentions", "decoder_attentions"])
                    for (let te in r)
                        te.startsWith(X) && (X in P || (P[X] = []),
                        P[X].push(r[te]));
                return P
            }
            addPastKeyValues(r, P) {
                if (P)
                    Object.assign(r, P);
                else {
                    let X = this.sessions.decoder_model_merged ?? this.sessions.model
                      , te = (r[this.main_input_name] ?? r.attention_mask)?.dims?.[0] ?? 1
                      , oe = X?.config?.kv_cache_dtype ?? "float32"
                      , me = oe === "float16" ? a.DataTypeMap.float16 : a.DataTypeMap.float32
                      , ve = (0,
                    l.getCacheShapes)(this.config, {
                        batch_size: te
                    });
                    for (let Ce in ve) {
                        let Ge = ve[Ce].reduce( (et, tt) => et * tt, 1);
                        r[Ce] = new a.Tensor(oe,new me(Ge),ve[Ce])
                    }
                }
            }
            async encode_image({pixel_values: r}) {
                return (await j(this.sessions.vision_encoder, {
                    pixel_values: r
                })).image_features
            }
            async encode_text({input_ids: r}) {
                return (await j(this.sessions.embed_tokens, {
                    input_ids: r
                })).inputs_embeds
            }
            async encode_audio({audio_values: r}) {
                return (await j(this.sessions.audio_encoder, {
                    audio_values: r
                })).audio_features
            }
        }
        class Y {
        }
        class _e extends Y {
            constructor({last_hidden_state: r, hidden_states: P=null, attentions: X=null}) {
                super(),
                this.last_hidden_state = r,
                this.hidden_states = P,
                this.attentions = X
            }
        }
        class ue extends c {
        }
        class Me extends ue {
        }
        class re extends ue {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class pe extends ue {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class se extends ue {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Te extends ue {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Ee extends c {
        }
        class ye extends Ee {
        }
        class Pe extends Ee {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Se extends Ee {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class De extends Ee {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Ve extends Ee {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Re extends c {
        }
        class $e extends Re {
        }
        class ze extends Re {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Ze extends Re {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ie extends Re {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class st extends c {
        }
        class qe extends st {
        }
        class ht extends st {
        }
        class Kt extends c {
        }
        class Zt extends Kt {
        }
        class Gt extends c {
        }
        class Ft extends Gt {
        }
        class $t extends Gt {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Rs extends Gt {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class zs extends Gt {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Gs extends Gt {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class ds extends c {
        }
        class Ws extends ds {
        }
        class Ye extends ds {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Ls extends ds {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class nt extends ds {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class As extends ds {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class n extends c {
        }
        class B extends n {
        }
        class w extends n {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class O extends n {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class K extends n {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class ie extends n {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class fe extends c {
        }
        class Ue extends fe {
        }
        class Qe extends fe {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Oe extends fe {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class lt extends fe {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class ct extends fe {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class St extends c {
        }
        class ft extends St {
        }
        class es extends St {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class ss extends St {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Jt extends St {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Bt extends St {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class rs extends c {
        }
        class Ps extends rs {
        }
        class Ts extends rs {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class hs extends rs {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class ys extends rs {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class ws extends rs {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class os extends c {
        }
        class us extends os {
        }
        class ps extends os {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ds extends os {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class bs extends os {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class xs extends os {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class as extends c {
        }
        class vs extends as {
        }
        class Is extends as {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Yt extends as {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Fe extends as {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class ke extends c {
        }
        class Ke extends ke {
        }
        class wt extends ke {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Os extends ke {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Es extends ke {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class ns extends c {
        }
        class Ys extends ns {
        }
        class qs extends ns {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Zs extends ns {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class er extends ns {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class or extends ns {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class q extends c {
        }
        class i extends q {
        }
        class F extends q {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class z extends q {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class G extends q {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class ne extends c {
        }
        class ge extends ne {
        }
        class Be extends ne {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class je extends ne {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Ne extends ne {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class Le extends c {
            forward_params = ["input_ids", "attention_mask", "encoder_outputs", "decoder_input_ids", "decoder_attention_mask", "past_key_values"]
        }
        class _t extends Le {
        }
        class ot extends Le {
        }
        class bt extends c {
        }
        class Vt extends bt {
        }
        class kt extends bt {
        }
        class Wt extends c {
        }
        class Rt extends Wt {
        }
        class is extends Wt {
        }
        class fs extends c {
        }
        class Xt extends fs {
        }
        class Fs extends fs {
        }
        class xt extends fs {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Lt extends c {
        }
        class qt extends Lt {
        }
        class ms extends Lt {
        }
        class gs extends Lt {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Qt extends Lt {
        }
        class ls extends c {
        }
        class zt extends ls {
        }
        class At extends ls {
        }
        class yt extends c {
        }
        class Dt extends yt {
        }
        class ts extends yt {
        }
        class Ms extends c {
        }
        class ar extends Ms {
        }
        class wa extends Ms {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class ba extends Ms {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class xa extends Ms {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class va extends Ms {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Us extends c {
        }
        class Ea extends Us {
        }
        class Fa extends Us {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class ka extends Us {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ca extends Us {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Sa extends Us {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Ks extends c {
        }
        class La extends Ks {
        }
        class Aa extends Ks {
            async _call(r) {
                return new jt(await super._call(r))
            }
        }
        class ya extends Ks {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Da extends Ks {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Ia extends Ks {
            async _call(r) {
                return new Ut(await super._call(r))
            }
        }
        class Sr extends c {
        }
        class Oa extends Sr {
        }
        class Ba extends Sr {
        }
        class Lr extends c {
            requires_attention_mask = !1;
            main_input_name = "input_features";
            forward_params = ["input_features", "attention_mask", "decoder_input_ids", "decoder_attention_mask", "past_key_values"]
        }
        class ja extends Lr {
        }
        class Ar extends Lr {
            _prepare_generation_config(r, P) {
                return super._prepare_generation_config(r, P, k.WhisperGenerationConfig)
            }
            _retrieve_init_tokens(r) {
                let P = [r.decoder_start_token_id]
                  , X = r.language
                  , te = r.task;
                if (r.is_multilingual) {
                    X || (console.warn("No language specified - defaulting to English (en)."),
                    X = "en");
                    let me = `<|${(0,
                    I.whisper_language_to_code)(X)}|>`;
                    P.push(r.lang_to_id[me]),
                    P.push(r.task_to_id[te ?? "transcribe"])
                } else if (X || te)
                    throw new Error("Cannot specify `task` or `language` for an English-only model. If the model is intended to be multilingual, pass `is_multilingual=true` to generate, or update the generation config.");
                return !r.return_timestamps && r.no_timestamps_token_id && P.at(-1) !== r.no_timestamps_token_id ? P.push(r.no_timestamps_token_id) : r.return_timestamps && P.at(-1) === r.no_timestamps_token_id && (console.warn("<|notimestamps|> prompt token is removed from generation_config since `return_timestamps` is set to `true`."),
                P.pop()),
                P.filter(oe => oe != null)
            }
            async generate({inputs: r=null, generation_config: P=null, logits_processor: X=null, stopping_criteria: te=null, ...oe}) {
                P = this._prepare_generation_config(P, oe);
                let me = oe.decoder_input_ids ?? this._retrieve_init_tokens(P);
                if (P.return_timestamps && (X ??= new L.LogitsProcessorList,
                X.push(new L.WhisperTimeStampLogitsProcessor(P,me))),
                P.begin_suppress_tokens && (X ??= new L.LogitsProcessorList,
                X.push(new L.SuppressTokensAtBeginLogitsProcessor(P.begin_suppress_tokens,me.length))),
                P.return_token_timestamps) {
                    if (!P.alignment_heads)
                        throw new Error("Model generation config has no `alignment_heads`, token-level timestamps not available. See https://gist.github.com/hollance/42e32852f24243b748ae6bc1f985b13a on how to add this property to the generation config.");
                    P.task === "translate" && console.warn("Token-level timestamps may not be reliable for task 'translate'."),
                    P.output_attentions = !0,
                    P.return_dict_in_generate = !0
                }
                let ve = await super.generate({
                    inputs: r,
                    generation_config: P,
                    logits_processor: X,
                    decoder_input_ids: me,
                    ...oe
                });
                return P.return_token_timestamps && (ve.token_timestamps = this._extract_token_timestamps(ve, P.alignment_heads, P.num_frames)),
                ve
            }
            _extract_token_timestamps(r, P, X=null, te=.02) {
                if (!r.cross_attentions)
                    throw new Error("Model outputs must contain cross attentions to extract timestamps. This is most likely because the model was not exported with `output_attentions=True`.");
                X == null && console.warn("`num_frames` has not been set, meaning the entire audio will be analyzed. This may lead to inaccurate token-level timestamps for short audios (< 30 seconds).");
                let oe = this.config.median_filter_width;
                oe === void 0 && (console.warn("Model config has no `median_filter_width`, using default value of 7."),
                oe = 7);
                let me = r.cross_attentions
                  , ve = Array.from({
                    length: this.config.decoder_layers
                }, (Je, Xe) => (0,
                a.cat)(me.map(dt => dt[Xe]), 2))
                  , Ce = (0,
                a.stack)(P.map( ([Je,Xe]) => {
                    if (Je >= ve.length)
                        throw new Error(`Layer index ${Je} is out of bounds for cross attentions (length ${ve.length}).`);
                    return X ? ve[Je].slice(null, Xe, null, [0, X]) : ve[Je].slice(null, Xe)
                }
                )).transpose(1, 0, 2, 3)
                  , [Ge,et] = (0,
                a.std_mean)(Ce, -2, 0, !0)
                  , tt = Ce.clone();
                for (let Je = 0; Je < tt.dims[0]; ++Je) {
                    let Xe = tt[Je];
                    for (let dt = 0; dt < Xe.dims[0]; ++dt) {
                        let Mt = Xe[dt]
                          , gt = Ge[Je][dt][0].data
                          , Tt = et[Je][dt][0].data;
                        for (let Et = 0; Et < Mt.dims[0]; ++Et) {
                            let Ct = Mt[Et].data;
                            for (let it = 0; it < Ct.length; ++it)
                                Ct[it] = (Ct[it] - Tt[it]) / gt[it];
                            Ct.set((0,
                            g.medianFilter)(Ct, oe))
                        }
                    }
                }
                let at = [(0,
                a.mean)(tt, 1)]
                  , He = r.sequences.dims
                  , ut = new a.Tensor("float32",new Float32Array(He[0] * He[1]),He);
                for (let Je = 0; Je < He[0]; ++Je) {
                    let Xe = at[Je].neg().squeeze_(0)
                      , [dt,Mt] = (0,
                    g.dynamic_time_warping)(Xe.tolist())
                      , gt = Array.from({
                        length: dt.length - 1
                    }, (Ct, it) => dt[it + 1] - dt[it])
                      , Tt = (0,
                    C.mergeArrays)([1], gt).map(Ct => !!Ct)
                      , Et = [];
                    for (let Ct = 0; Ct < Tt.length; ++Ct)
                        Tt[Ct] && Et.push(Mt[Ct] * te);
                    ut[Je].data.set(Et, 1)
                }
                return ut
            }
        }
        class Na extends Ar {
        }
        class yr extends c {
            requires_attention_mask = !1;
            main_input_name = "input_values";
            forward_params = ["input_values", "decoder_input_ids", "past_key_values"]
        }
        class Od extends yr {
        }
        class Va extends yr {
        }
        class Dr extends c {
            main_input_name = "pixel_values";
            forward_params = ["pixel_values", "decoder_input_ids", "encoder_hidden_states", "past_key_values"]
        }
        class Ir extends c {
            forward_params = ["input_ids", "attention_mask", "pixel_values", "position_ids", "past_key_values"]
        }
        class nr extends Ir {
            _merge_input_ids_with_image_features(r) {
                let P = r.image_features.dims.at(-1)
                  , X = r.image_features.view(-1, P);
                return ce({
                    image_token_id: this.config.image_token_index,
                    ...r,
                    image_features: X
                })
            }
        }
        class Ra extends nr {
        }
        class za extends nr {
        }
        class Ga extends c {
            forward_params = ["input_ids", "inputs_embeds", "attention_mask", "pixel_values", "encoder_outputs", "decoder_input_ids", "decoder_inputs_embeds", "decoder_attention_mask", "past_key_values"];
            main_input_name = "inputs_embeds"
        }
        class Wa extends Ga {
            _merge_input_ids_with_image_features({inputs_embeds: r, image_features: P, input_ids: X, attention_mask: te}) {
                return {
                    inputs_embeds: (0,
                    a.cat)([P, r], 1),
                    attention_mask: (0,
                    a.cat)([(0,
                    a.ones)(P.dims.slice(0, 2)), te], 1)
                }
            }
            async _prepare_inputs_embeds({input_ids: r, pixel_values: P, inputs_embeds: X, attention_mask: te}) {
                if (!r && !P)
                    throw new Error("Either `input_ids` or `pixel_values` should be provided.");
                let oe, me;
                return r && (oe = await this.encode_text({
                    input_ids: r
                })),
                P && (me = await this.encode_image({
                    pixel_values: P
                })),
                oe && me ? {inputs_embeds: X, attention_mask: te} = this._merge_input_ids_with_image_features({
                    inputs_embeds: oe,
                    image_features: me,
                    input_ids: r,
                    attention_mask: te
                }) : X = oe || me,
                {
                    inputs_embeds: X,
                    attention_mask: te
                }
            }
            async forward({input_ids: r, pixel_values: P, attention_mask: X, decoder_input_ids: te, decoder_attention_mask: oe, encoder_outputs: me, past_key_values: ve, inputs_embeds: Ce, decoder_inputs_embeds: Ge}) {
                if (Ce || ({inputs_embeds: Ce, attention_mask: X} = await this._prepare_inputs_embeds({
                    input_ids: r,
                    pixel_values: P,
                    inputs_embeds: Ce,
                    attention_mask: X
                })),
                !me) {
                    let {last_hidden_state: at} = await Z(this, {
                        inputs_embeds: Ce,
                        attention_mask: X
                    });
                    me = at
                }
                if (!Ge) {
                    if (!te)
                        throw new Error("Either `decoder_input_ids` or `decoder_inputs_embeds` should be provided.");
                    Ge = await this.encode_text({
                        input_ids: te
                    })
                }
                return await le(this, {
                    inputs_embeds: Ge,
                    attention_mask: oe,
                    encoder_attention_mask: X,
                    encoder_hidden_states: me,
                    past_key_values: ve
                }, !0)
            }
        }
        class Ua extends c {
            forward_params = ["input_ids", "attention_mask", "pixel_values", "position_ids", "past_key_values"]
        }
        class Ka extends Ua {
            _merge_input_ids_with_image_features(r) {
                let P = r.image_features.dims.at(-1)
                  , X = r.image_features.view(-1, P);
                return ce({
                    image_token_id: this.config.image_token_index,
                    ...r,
                    image_features: X
                })
            }
        }
        class $a extends Ir {
            _merge_input_ids_with_image_features(r) {
                let P = r.image_features.dims.at(-1)
                  , X = r.image_features.view(-1, P);
                return ce({
                    image_token_id: this.config.image_token_index,
                    ...r,
                    image_features: X
                })
            }
        }
        class Qa extends c {
            forward_params = ["input_ids", "attention_mask", "inputs_embeds", "per_layer_inputs", "position_ids", "pixel_values", "input_features", "input_features_mask", "past_key_values"]
        }
        class Or extends Qa {
            async forward({input_ids: r=null, attention_mask: P=null, pixel_values: X=null, input_features: te=null, input_features_mask: oe=null, position_ids: me=null, inputs_embeds: ve=null, per_layer_inputs: Ce=null, past_key_values: Ge=null, generation_config: et=null, logits_processor: tt=null, ...at}) {
                if ((!ve || !Ce) && ({inputs_embeds: ve, per_layer_inputs: Ce} = await j(this.sessions.embed_tokens, {
                    input_ids: r
                }),
                r.dims[1] !== 1)) {
                    if (X) {
                        let {image_features: ut} = await j(this.sessions.vision_encoder, {
                            pixel_values: X
                        });
                        ({inputs_embeds: ve, attention_mask: P} = this._merge_input_ids_with_image_features({
                            image_features: ut,
                            inputs_embeds: ve,
                            input_ids: r,
                            attention_mask: P
                        }))
                    }
                    if (te) {
                        let {audio_features: ut} = await j(this.sessions.audio_encoder, {
                            input_features: te,
                            input_features_mask: oe
                        });
                        ({inputs_embeds: ve, attention_mask: P} = this._merge_input_ids_with_audio_features({
                            audio_features: ut,
                            inputs_embeds: ve,
                            input_ids: r,
                            attention_mask: P
                        }))
                    }
                }
                return await le(this, {
                    inputs_embeds: ve,
                    per_layer_inputs: Ce,
                    past_key_values: Ge,
                    attention_mask: P,
                    position_ids: me,
                    generation_config: et,
                    logits_processor: tt
                }, !0)
            }
            _merge_input_ids_with_image_features(r) {
                let P = r.image_features.dims.at(-1)
                  , X = r.image_features.view(-1, P);
                return ce({
                    image_token_id: this.config.image_token_id,
                    ...r,
                    image_features: X
                })
            }
            _merge_input_ids_with_audio_features(r) {
                let P = r.audio_features.dims.at(-1)
                  , X = r.audio_features.view(-1, P);
                return Q({
                    audio_token_id: this.config.audio_token_id,
                    ...r,
                    audio_features: X
                })
            }
        }
        class Xa extends c {
            forward_params = ["input_ids", "attention_mask", "pixel_values", "pixel_attention_mask", "position_ids", "past_key_values"]
        }
        class ir extends Xa {
            async encode_image({pixel_values: r, pixel_attention_mask: P}) {
                return (await j(this.sessions.vision_encoder, {
                    pixel_values: r,
                    pixel_attention_mask: P
                })).image_features
            }
            _merge_input_ids_with_image_features(r) {
                let P = r.image_features.dims.at(-1)
                  , X = r.image_features.view(-1, P);
                return ce({
                    image_token_id: this.config.image_token_id,
                    ...r,
                    image_features: X
                })
            }
        }
        class Br extends ir {
        }
        class Ha extends c {
            forward_params = ["input_ids", "inputs_embeds", "attention_mask", "position_ids", "pixel_values", "image_sizes", "past_key_values"]
        }
        class jr extends Ha {
            async forward({input_ids: r=null, attention_mask: P=null, pixel_values: X=null, image_sizes: te=null, position_ids: oe=null, inputs_embeds: me=null, past_key_values: ve=null, generation_config: Ce=null, logits_processor: Ge=null, ...et}) {
                if (!me) {
                    let at;
                    if (X && r.dims[1] !== 1) {
                        if (!te)
                            throw new Error("`image_sizes` must be provided when `pixel_values` is provided.");
                        ({image_features: at} = await j(this.sessions.vision_encoder, {
                            pixel_values: X,
                            image_sizes: te
                        }))
                    } else {
                        let He = this.config.normalized_config.hidden_size;
                        at = new a.Tensor("float32",[],[0, He])
                    }
                    ({inputs_embeds: me} = await j(this.sessions.prepare_inputs_embeds, {
                        input_ids: r,
                        image_features: at
                    }))
                }
                return await le(this, {
                    inputs_embeds: me,
                    past_key_values: ve,
                    attention_mask: P,
                    position_ids: oe,
                    generation_config: Ce,
                    logits_processor: Ge
                }, !1)
            }
        }
        class Bs extends c {
        }
        class Ja extends Bs {
        }
        class Bd extends Bs {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "text_model"
                })
            }
        }
        class Ya extends Bs {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "text_model"
                })
            }
        }
        class jd extends Bs {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "vision_model"
                })
            }
        }
        class qa extends Bs {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "vision_model"
                })
            }
        }
        class Nr extends c {
        }
        class Za extends Nr {
        }
        class en extends Nr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "text_model"
                })
            }
        }
        class tn extends Bs {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "vision_model"
                })
            }
        }
        class sn extends c {
        }
        class rn extends sn {
        }
        class lr extends c {
        }
        class on extends lr {
            async forward(r) {
                let P = !r.input_ids
                  , X = !r.pixel_values;
                if (P && X)
                    throw new Error("Either `input_ids` or `pixel_values` should be provided.");
                if (P && (r.input_ids = (0,
                a.ones)([r.pixel_values.dims[0], 1])),
                X) {
                    let {image_size: Ge} = this.config.vision_config;
                    r.pixel_values = (0,
                    a.full)([0, 3, Ge, Ge], 0)
                }
                let {text_embeddings: te, image_embeddings: oe, l2norm_text_embeddings: me, l2norm_image_embeddings: ve} = await super.forward(r)
                  , Ce = {};
                return P || (Ce.text_embeddings = te,
                Ce.l2norm_text_embeddings = me),
                X || (Ce.image_embeddings = oe,
                Ce.l2norm_image_embeddings = ve),
                Ce
            }
        }
        class an extends lr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "text_model"
                })
            }
        }
        class nn extends lr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "vision_model"
                })
            }
        }
        class Vr extends c {
        }
        class ln extends Vr {
        }
        class cn extends Vr {
        }
        class Rr extends c {
        }
        class _n extends Rr {
        }
        class dn extends Rr {
        }
        class zr extends c {
        }
        class un extends zr {
        }
        class pn extends zr {
        }
        class Gr extends c {
        }
        class mn extends Gr {
        }
        class Mn extends Gr {
        }
        class Wr extends c {
        }
        class hn extends Wr {
        }
        class fn extends Wr {
        }
        class Ur extends c {
        }
        class gn extends Ur {
        }
        class Pn extends Ur {
        }
        class Kr extends c {
        }
        class Tn extends Kr {
        }
        class wn extends Kr {
        }
        class $r extends c {
        }
        class bn extends $r {
        }
        class xn extends $r {
        }
        class Qr extends c {
        }
        class vn extends Qr {
        }
        class En extends Qr {
        }
        class Fn extends c {
        }
        class kn extends Fn {
        }
        class Xr extends c {
        }
        class Cn extends Xr {
        }
        class Sn extends Xr {
        }
        class Hr extends c {
        }
        class Ln extends Hr {
        }
        class An extends Hr {
        }
        class Jr extends c {
        }
        class yn extends Jr {
        }
        class Dn extends Jr {
        }
        class Yr extends c {
        }
        class In extends Yr {
        }
        class On extends Yr {
        }
        class qr extends c {
        }
        class Bn extends qr {
        }
        class jn extends qr {
        }
        class Zr extends c {
        }
        class Nn extends Zr {
        }
        class Vn extends Zr {
        }
        class eo extends c {
        }
        class Rn extends eo {
        }
        class zn extends eo {
        }
        class to extends c {
        }
        class Gn extends to {
        }
        class Wn extends to {
        }
        class so extends c {
        }
        class Un extends so {
        }
        class Kn extends so {
        }
        class ro extends c {
        }
        class $n extends ro {
        }
        class Qn extends ro {
        }
        class oo extends c {
        }
        class Xn extends oo {
        }
        class Hn extends oo {
        }
        class ao extends c {
        }
        class Jn extends ao {
        }
        class Yn extends ao {
        }
        class no extends c {
        }
        class qn extends no {
        }
        class Zn extends no {
        }
        class io extends c {
        }
        class ei extends io {
        }
        class ti extends io {
        }
        class lo extends c {
        }
        class si extends lo {
        }
        class ri extends lo {
        }
        class co extends c {
        }
        class oi extends co {
        }
        class ai extends co {
        }
        class _o extends c {
        }
        class ni extends _o {
        }
        class ii extends _o {
        }
        class uo extends c {
        }
        class li extends uo {
        }
        class ci extends uo {
        }
        class po extends c {
        }
        class _i extends po {
        }
        class di extends po {
        }
        class mo extends c {
        }
        class ui extends mo {
        }
        class pi extends mo {
        }
        class mi extends c {
            forward_params = ["input_ids", "attention_mask", "position_ids", "past_key_values", "pixel_values", "image_grid_thw"]
        }
        class Mi extends mi {
            get_rope_index(r, P, X, te) {
                let {vision_config: oe, image_token_id: me, video_token_id: ve, vision_start_token_id: Ce} = this.config
                  , Ge = oe.spatial_merge_size ?? 2
                  , et = [];
                if (P || X) {
                    let tt = r.tolist();
                    te || (te = (0,
                    a.ones_like)(r));
                    let at = te.tolist()
                      , He = Array.from({
                        length: 3
                    }, Mt => Array.from({
                        length: r.dims[0]
                    }, gt => Array.from({
                        length: r.dims[1]
                    }, Tt => 1)))
                      , ut = P ? P.tolist() : []
                      , Je = X ? X.tolist() : []
                      , Xe = 0
                      , dt = 0;
                    for (let Mt = 0; Mt < tt.length; ++Mt) {
                        let gt = tt[Mt].filter( (Pt, Ot) => at[Mt][Ot] == 1)
                          , Et = gt.reduce( (Pt, Ot, Ss) => (Ot == Ce && Pt.push(Ss),
                        Pt), []).map(Pt => gt[Pt + 1])
                          , Ct = Et.filter(Pt => Pt == me).length
                          , it = Et.filter(Pt => Pt == ve).length
                          , vt = []
                          , Nt = 0
                          , js = Ct
                          , Ht = it;
                        for (let Pt = 0; Pt < Et.length; ++Pt) {
                            let Ot = gt.findIndex( (Vs, _s) => _s > Nt && Vs == me), Ss = gt.findIndex( (Vs, _s) => _s > Nt && Vs == ve), Ns = js > 0 && Ot !== -1 ? Ot : gt.length + 1, Js = Ht > 0 && Ss !== -1 ? Ss : gt.length + 1, Fr, Ma, ha, fa;
                            Ns < Js ? ([Ma,ha,fa] = ut[Xe],
                            ++Xe,
                            --js,
                            Fr = Ns) : ([Ma,ha,fa] = Je[dt],
                            ++dt,
                            --Ht,
                            Fr = Js);
                            let[Au,ga,kr] = [Number(Ma), Math.floor(Number(ha) / Ge), Math.floor(Number(fa) / Ge)]
                              , Pa = Fr - Nt
                              , Dd = vt.length > 0 ? (0,
                            g.max)(vt.at(-1))[0] + 1 : 0;
                            vt.push(Array.from({
                                length: 3 * Pa
                            }, (Vs, _s) => Dd + _s % Pa));
                            let Ta = Pa + Dd
                              , Cr = Au * ga * kr
                              , yu = Array.from({
                                length: Cr
                            }, (Vs, _s) => Ta + Math.floor(_s / (ga * kr)))
                              , Du = Array.from({
                                length: Cr
                            }, (Vs, _s) => Ta + Math.floor(_s / kr) % ga)
                              , Iu = Array.from({
                                length: Cr
                            }, (Vs, _s) => Ta + _s % kr);
                            vt.push([yu, Du, Iu].flat()),
                            Nt = Fr + Cr
                        }
                        if (Nt < gt.length) {
                            let Pt = vt.length > 0 ? (0,
                            g.max)(vt.at(-1))[0] + 1 : 0
                              , Ot = gt.length - Nt;
                            vt.push(Array.from({
                                length: 3 * Ot
                            }, (Ss, Ns) => Pt + Ns % Ot))
                        }
                        let cs = vt.reduce( (Pt, Ot) => Pt + Ot.length, 0)
                          , Xs = new Array(cs)
                          , Hs = 0;
                        for (let Pt = 0; Pt < 3; ++Pt)
                            for (let Ot = 0; Ot < vt.length; ++Ot) {
                                let Ss = vt[Ot]
                                  , Ns = Ss.length / 3;
                                for (let Js = Pt * Ns; Js < (Pt + 1) * Ns; ++Js)
                                    Xs[Hs++] = Ss[Js]
                            }
                        let Er = 0
                          , rr = at[Mt];
                        for (let Pt = 0; Pt < rr.length; ++Pt)
                            if (rr[Pt] == 1) {
                                for (let Ot = 0; Ot < 3; ++Ot)
                                    He[Ot][Mt][Pt] = Xs[Ot * cs / 3 + Er];
                                ++Er
                            }
                        let Lu = (0,
                        g.max)(Xs)[0];
                        et.push(Lu + 1 - tt[Mt].length)
                    }
                    return [new a.Tensor("int64",He.flat(1 / 0),[3, r.dims[0], r.dims[1]]), new a.Tensor("int64",et,[et.length, 1])]
                } else if (te) {
                    let {data: tt, dims: at} = ae(te)
                      , He = BigInt64Array.from({
                        length: 3 * tt.length
                    }, (Je, Xe) => tt[Xe % tt.length])
                      , ut = Array.from({
                        length: at[0]
                    }, (Je, Xe) => (0,
                    g.max)(tt.subarray(at[1] * Xe, at[1] * (Xe + 1)))[0] + 1n + BigInt(at[1]));
                    return [new a.Tensor("int64",He,[3, ...at]), new a.Tensor("int64",ut,[ut.length, 1])]
                } else {
                    let[tt,at] = r.dims
                      , He = BigInt64Array.from({
                        length: 3 * tt * at
                    }, (ut, Je) => BigInt(Math.floor(Je % at / tt)));
                    return [new a.Tensor("int64",He,[3, ...r.dims]), (0,
                    a.zeros)([tt, 1])]
                }
            }
            async encode_image({pixel_values: r, image_grid_thw: P}) {
                return (await j(this.sessions.vision_encoder, {
                    pixel_values: r,
                    grid_thw: P
                })).image_features
            }
            _merge_input_ids_with_image_features(r) {
                return ce({
                    image_token_id: this.config.image_token_id,
                    ...r
                })
            }
            prepare_inputs_for_generation(r, P, X) {
                if (P.attention_mask && !P.position_ids)
                    if (!P.past_key_values)
                        [P.position_ids,P.rope_deltas] = this.get_rope_index(P.input_ids, P.image_grid_thw, P.video_grid_thw, P.attention_mask);
                    else {
                        P.pixel_values = null;
                        let te = BigInt(Object.values(P.past_key_values)[0].dims.at(-2))
                          , oe = P.rope_deltas.map(me => te + me);
                        P.position_ids = (0,
                        a.stack)([oe, oe, oe], 0)
                    }
                return P
            }
        }
        class Mo extends c {
        }
        class hi extends Mo {
        }
        class fi extends Mo {
        }
        class ho extends c {
        }
        class gi extends ho {
        }
        class Pi extends ho {
        }
        class fo extends c {
        }
        class Ti extends fo {
        }
        class wi extends fo {
        }
        class go extends c {
        }
        class bi extends go {
        }
        class xi extends go {
        }
        class Po extends c {
        }
        class vi extends Po {
        }
        class Ei extends Po {
        }
        class To extends c {
        }
        class Fi extends To {
        }
        class ki extends To {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class wo extends c {
        }
        class Ci extends wo {
        }
        class Si extends wo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Li extends c {
        }
        class Ai extends Li {
        }
        class bo extends c {
        }
        class yi extends bo {
        }
        class Di extends bo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ii extends c {
        }
        class Oi extends Ii {
        }
        class xo extends c {
        }
        class Bi extends xo {
        }
        class ji extends xo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ni extends c {
        }
        class Vi extends Ni {
        }
        class vo extends c {
        }
        class Ri extends vo {
        }
        class zi extends vo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Gi extends c {
        }
        class Wi extends Gi {
            async _call(r) {
                return new Ad(await super._call(r))
            }
        }
        class Eo extends c {
        }
        class Ui extends Eo {
        }
        class Ki extends Eo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Fo extends c {
        }
        class $i extends Fo {
        }
        class Qi extends Fo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class ko extends c {
        }
        class Xi extends ko {
        }
        class Hi extends ko {
        }
        class Co extends c {
        }
        class Ji extends Co {
        }
        class Yi extends Co {
        }
        class So extends c {
        }
        class qi extends So {
        }
        class Zi extends So {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class cr extends c {
        }
        class el extends cr {
        }
        class tl extends cr {
            async _call(r) {
                return new Ao(await super._call(r))
            }
        }
        class Lo extends cr {
            async _call(r) {
                return new sl(await super._call(r))
            }
        }
        class Ao extends Y {
            constructor({logits: r, pred_boxes: P}) {
                super(),
                this.logits = r,
                this.pred_boxes = P
            }
        }
        class sl extends Y {
            constructor({logits: r, pred_boxes: P, pred_masks: X}) {
                super(),
                this.logits = r,
                this.pred_boxes = P,
                this.pred_masks = X
            }
        }
        class yo extends c {
        }
        class rl extends yo {
        }
        class ol extends yo {
            async _call(r) {
                return new tr(await super._call(r))
            }
        }
        class tr extends Y {
            constructor({logits: r, pred_boxes: P}) {
                super(),
                this.logits = r,
                this.pred_boxes = P
            }
        }
        class Do extends c {
        }
        class al extends Do {
        }
        class nl extends Do {
            async _call(r) {
                return new il(await super._call(r))
            }
        }
        class il extends tr {
        }
        class Io extends c {
        }
        class ll extends Io {
        }
        class cl extends Io {
            async _call(r) {
                return new _l(await super._call(r))
            }
        }
        class _l extends tr {
        }
        class Oo extends c {
        }
        class dl extends Oo {
        }
        class ul extends Oo {
            async _call(r) {
                return new tr(await super._call(r))
            }
        }
        class Bo extends c {
        }
        class pl extends Bo {
        }
        class ml extends Bo {
            async _call(r) {
                return new Ml(await super._call(r))
            }
        }
        class Ml extends Ao {
        }
        class jo extends c {
        }
        class hl extends jo {
        }
        class fl extends jo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class No extends c {
        }
        class gl extends No {
        }
        class Pl extends No {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Vo extends c {
        }
        class Tl extends Vo {
        }
        class wl extends Vo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class _r extends c {
        }
        class bl extends _r {
        }
        class xl extends _r {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class vl extends _r {
        }
        class Ro extends c {
        }
        class El extends Ro {
        }
        class Fl extends Ro {
        }
        class zo extends c {
        }
        class kl extends zo {
        }
        class Cl extends zo {
        }
        class Sl extends c {
        }
        class Ll extends Sl {
        }
        class dr extends c {
        }
        class Al extends dr {
        }
        class yl extends dr {
        }
        class Dl extends dr {
        }
        class Il extends c {
        }
        class Ol extends Il {
        }
        class Bl extends c {
        }
        class jl extends Bl {
        }
        class Nl extends c {
        }
        class Vl extends Nl {
        }
        class Go extends c {
        }
        class Rl extends Go {
        }
        class zl extends Go {
        }
        class Wo extends c {
        }
        class Gl extends Wo {
        }
        class Wl extends Wo {
        }
        class Ul extends c {
        }
        class Kl extends Ul {
        }
        class Uo extends c {
        }
        class $l extends Uo {
        }
        class Ql extends Uo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Ko extends c {
        }
        class Xl extends Ko {
        }
        class Hl extends Ko {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class $o extends c {
        }
        class Jl extends $o {
        }
        class Yl extends $o {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Qo extends c {
        }
        class ql extends Qo {
        }
        class Zl extends Qo {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class ec extends c {
        }
        class tc extends ec {
        }
        class sc extends c {
        }
        class rc extends sc {
        }
        class oc extends c {
        }
        class ac extends oc {
        }
        class Xo extends c {
        }
        class nc extends Xo {
        }
        class ic extends Xo {
            async _call(r) {
                return new lc(await super._call(r))
            }
        }
        class lc extends Y {
            constructor({logits: r, pred_boxes: P}) {
                super(),
                this.logits = r,
                this.pred_boxes = P
            }
        }
        class cc extends c {
        }
        class _c extends cc {
            async get_image_embeddings({pixel_values: r}) {
                return await Z(this, {
                    pixel_values: r
                })
            }
            async forward(r) {
                !r.image_embeddings || !r.image_positional_embeddings ? r = {
                    ...r,
                    ...await this.get_image_embeddings(r)
                } : r = {
                    ...r
                },
                r.input_labels ??= (0,
                a.ones)(r.input_points.dims.slice(0, -1));
                let P = {
                    image_embeddings: r.image_embeddings,
                    image_positional_embeddings: r.image_positional_embeddings
                };
                return r.input_points && (P.input_points = r.input_points),
                r.input_labels && (P.input_labels = r.input_labels),
                r.input_boxes && (P.input_boxes = r.input_boxes),
                await j(this.sessions.prompt_encoder_mask_decoder, P)
            }
            async _call(r) {
                return new dc(await super._call(r))
            }
        }
        class dc extends Y {
            constructor({iou_scores: r, pred_masks: P}) {
                super(),
                this.iou_scores = r,
                this.pred_masks = P
            }
        }
        class uc extends Y {
            constructor({iou_scores: r, pred_masks: P, object_score_logits: X}) {
                super(),
                this.iou_scores = r,
                this.pred_masks = P,
                this.object_score_logits = X
            }
        }
        class pc extends c {
        }
        class ur extends pc {
            async get_image_embeddings({pixel_values: r}) {
                return await Z(this, {
                    pixel_values: r
                })
            }
            async forward(r) {
                let {num_feature_levels: P} = this.config.vision_config;
                if (Array.from({
                    length: P
                }, (me, ve) => `image_embeddings.${ve}`).some(me => !r[me]) ? r = {
                    ...r,
                    ...await this.get_image_embeddings(r)
                } : r = {
                    ...r
                },
                r.input_points) {
                    if (r.input_boxes && r.input_boxes.dims[1] !== 1)
                        throw new Error("When both `input_points` and `input_boxes` are provided, the number of boxes per image must be 1.");
                    let me = r.input_points.dims;
                    r.input_labels ??= (0,
                    a.ones)(me.slice(0, -1)),
                    r.input_boxes ??= (0,
                    a.full)([me[0], 0, 4], 0)
                } else if (r.input_boxes) {
                    let me = r.input_boxes.dims;
                    r.input_labels = (0,
                    a.full)([me[0], me[1], 0], -1n),
                    r.input_points = (0,
                    a.full)([me[0], 1, 0, 2], 0)
                } else
                    throw new Error("At least one of `input_points` or `input_boxes` must be provided.");
                let te = this.sessions.prompt_encoder_mask_decoder
                  , oe = (0,
                C.pick)(r, te.inputNames);
                return await j(te, oe)
            }
            async _call(r) {
                return new uc(await super._call(r))
            }
        }
        class mc extends ur {
        }
        class Mc extends ur {
        }
        class Ho extends c {
        }
        class hc extends Ho {
        }
        class fc extends Ho {
        }
        class Jo extends c {
        }
        class gc extends Jo {
        }
        class Pc extends Jo {
        }
        class ks extends c {
        }
        class Tc extends ks {
        }
        class wc extends ks {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class bc extends ks {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class xc extends ks {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class vc extends c {
        }
        class Ec extends vc {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class Yo extends c {
        }
        class Fc extends Yo {
        }
        class kc extends Yo {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Cc extends c {
        }
        class Sc extends Cc {
        }
        class pr extends c {
        }
        class Lc extends pr {
        }
        class Ac extends pr {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class yc extends pr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class sr extends c {
        }
        class Dc extends sr {
        }
        class Ic extends sr {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class Oc extends sr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Bc extends sr {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class mr extends c {
        }
        class jc extends mr {
        }
        class Nc extends mr {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class Vc extends mr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class Nd extends c {
        }
        class Rc extends ks {
        }
        class zc extends ks {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class Gc extends ks {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class $s extends c {
        }
        class Wc extends $s {
        }
        class Uc extends $s {
            async _call(r) {
                return new Cs(await super._call(r))
            }
        }
        class Kc extends $s {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class $c extends $s {
            async _call(r) {
                return new Ld(await super._call(r))
            }
        }
        class Qc extends $s {
            async _call(r) {
                return new It(await super._call(r))
            }
        }
        class Xc extends c {
        }
        class Hc extends Xc {
        }
        class Mr extends c {
        }
        class Vd extends Mr {
        }
        class Jc extends Mr {
        }
        class Yc extends Mr {
            async generate_speech(r, P, {threshold: X=.5, minlenratio: te=0, maxlenratio: oe=20, vocoder: me=null}={}) {
                let ve = {
                    input_ids: r
                }
                  , {encoder_outputs: Ce, encoder_attention_mask: Ge} = await Z(this, ve)
                  , et = Ce.dims[1] / this.config.reduction_factor
                  , tt = Math.floor(et * oe)
                  , at = Math.floor(et * te)
                  , He = this.config.num_mel_bins
                  , ut = []
                  , Je = null
                  , Xe = null
                  , dt = 0;
                for (; ; ) {
                    ++dt;
                    let Tt = U(!!Xe), Et;
                    Xe ? Et = Xe.output_sequence_out : Et = new a.Tensor("float32",new Float32Array(He),[1, 1, He]);
                    let Ct = {
                        use_cache_branch: Tt,
                        output_sequence: Et,
                        encoder_attention_mask: Ge,
                        speaker_embeddings: P,
                        encoder_hidden_states: Ce
                    };
                    this.addPastKeyValues(Ct, Je),
                    Xe = await j(this.sessions.decoder_model_merged, Ct),
                    Je = this.getPastKeyValues(Xe, Je);
                    let {prob: it, spectrum: vt} = Xe;
                    if (ut.push(vt),
                    dt >= at && (Array.from(it.data).filter(Nt => Nt >= X).length > 0 || dt >= tt))
                        break
                }
                let Mt = (0,
                a.cat)(ut)
                  , {waveform: gt} = await j(me.sessions.model, {
                    spectrogram: Mt
                });
                return {
                    spectrogram: Mt,
                    waveform: gt
                }
            }
        }
        class qc extends c {
            main_input_name = "spectrogram"
        }
        class Zc extends c {
        }
        class qo extends Zc {
            async generate_speech({input_ids: r, attention_mask: P, style: X, num_inference_steps: te=5, speed: oe=1.05}) {
                let {sampling_rate: me, chunk_compress_factor: ve, base_chunk_size: Ce, latent_dim: Ge} = this.config
                  , {last_hidden_state: et, durations: tt} = await j(this.sessions.text_encoder, {
                    input_ids: r,
                    attention_mask: P,
                    style: X
                });
                tt.div_(oe);
                let at = tt.max().item() * me
                  , He = Ce * ve
                  , ut = Math.floor((at + He - 1) / He)
                  , Je = r.dims[0]
                  , Xe = (0,
                a.ones)([Je, ut])
                  , dt = (0,
                a.full)([Je], te)
                  , Mt = (0,
                a.randn)([Je, Ge * ve, ut]);
                for (let Tt = 0; Tt < te; ++Tt) {
                    let Et = (0,
                    a.full)([Je], Tt);
                    ({denoised_latents: Mt} = await j(this.sessions.latent_denoiser, {
                        style: X,
                        noisy_latents: Mt,
                        latent_mask: Xe,
                        encoder_outputs: et,
                        attention_mask: P,
                        timestep: Et,
                        num_inference_steps: dt
                    }))
                }
                let {waveform: gt} = await j(this.sessions.voice_decoder, {
                    latents: Mt
                });
                return {
                    waveform: gt,
                    durations: tt
                }
            }
        }
        class e_ extends c {
        }
        class t_ extends e_ {
        }
        class Zo extends c {
        }
        class s_ extends Zo {
        }
        class r_ extends Zo {
        }
        class ea extends c {
        }
        class o_ extends ea {
        }
        class a_ extends ea {
        }
        class ta extends c {
        }
        class n_ extends ta {
        }
        class i_ extends ta {
        }
        class sa extends c {
        }
        class l_ extends sa {
        }
        class c_ extends sa {
        }
        class hr extends c {
        }
        class __ extends hr {
        }
        class d_ extends hr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "text_model"
                })
            }
        }
        class u_ extends hr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "audio_model"
                })
            }
        }
        class p_ extends c {
        }
        class ra extends p_ {
            async _call(r) {
                return new yd(await super._call(r))
            }
        }
        class fr extends c {
        }
        class Rd extends fr {
        }
        class m_ extends fr {
        }
        class M_ extends fr {
        }
        class oa extends c {
        }
        class h_ extends oa {
        }
        class f_ extends oa {
        }
        class aa extends c {
        }
        class g_ extends aa {
        }
        class P_ extends aa {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class na extends c {
        }
        class zd extends na {
        }
        class Gd extends na {
        }
        class ia extends c {
            forward_params = ["input_ids", "attention_mask", "encoder_outputs", "decoder_input_ids", "decoder_attention_mask", "past_key_values"];
            _apply_and_filter_by_delay_pattern_mask(r) {
                let[P,X] = r.dims
                  , te = this.config.decoder.num_codebooks
                  , oe = X - te
                  , me = 0;
                for (let Ge = 0; Ge < r.size; ++Ge) {
                    if (r.data[Ge] === this.config.decoder.pad_token_id)
                        continue;
                    let et = Ge % X
                      , tt = Math.floor(Ge / X) % te
                      , at = et - tt;
                    at > 0 && at <= oe && (r.data[me++] = r.data[Ge])
                }
                let ve = Math.floor(P / te)
                  , Ce = me / (ve * te);
                return new a.Tensor(r.type,r.data.slice(0, me),[ve, te, Ce])
            }
            prepare_inputs_for_generation(r, P, X) {
                let te = structuredClone(r);
                for (let me = 0; me < te.length; ++me)
                    for (let ve = 0; ve < te[me].length; ++ve)
                        me % this.config.decoder.num_codebooks >= ve && (te[me][ve] = BigInt(this.config.decoder.pad_token_id));
                return X.guidance_scale !== null && X.guidance_scale > 1 && (te = te.concat(te)),
                super.prepare_inputs_for_generation(te, P, X)
            }
            async generate(r) {
                let P = await super.generate(r)
                  , X = this._apply_and_filter_by_delay_pattern_mask(P).unsqueeze_(0)
                  , {audio_values: te} = await j(this.sessions.encodec_decode, {
                    audio_codes: X
                });
                return te
            }
        }
        class gr extends c {
        }
        class T_ extends gr {
        }
        class w_ extends gr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class b_ extends gr {
        }
        class Pr extends c {
        }
        class x_ extends Pr {
        }
        class v_ extends Pr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class E_ extends Pr {
        }
        class Tr extends c {
        }
        class F_ extends Tr {
        }
        class k_ extends Tr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class C_ extends Tr {
        }
        class wr extends c {
        }
        class S_ extends wr {
        }
        class L_ extends wr {
            async _call(r) {
                return new rt(await super._call(r))
            }
        }
        class A_ extends wr {
        }
        class y_ extends c {
        }
        class D_ extends y_ {
        }
        class I_ extends c {
        }
        class O_ extends I_ {
            forward_params = ["input_ids", "pixel_values", "images_seq_mask", "images_emb_mask", "attention_mask", "position_ids", "past_key_values"];
            constructor(...r) {
                super(...r),
                this._generation_mode = "text"
            }
            async forward(r) {
                let P = this._generation_mode ?? "text", X;
                if (P === "text" || !r.past_key_values) {
                    let Ce = this.sessions.prepare_inputs_embeds
                      , Ge = (0,
                    C.pick)(r, Ce.inputNames);
                    X = await j(Ce, Ge)
                } else {
                    let Ce = this.sessions.gen_img_embeds
                      , Ge = (0,
                    C.pick)({
                        image_ids: r.input_ids
                    }, Ce.inputNames);
                    X = await j(Ce, Ge)
                }
                let te = {
                    ...r,
                    ...X
                }
                  , oe = await le(this, te)
                  , me = this.sessions[P === "text" ? "lm_head" : "gen_head"];
                if (!me)
                    throw new Error(`Unable to find "${me}" generation head`);
                let ve = await j(me, (0,
                C.pick)(oe, me.inputNames));
                return {
                    ...X,
                    ...oe,
                    ...ve
                }
            }
            async generate(r) {
                return this._generation_mode = "text",
                super.generate(r)
            }
            async generate_images(r) {
                this._generation_mode = "image";
                let P = (r.inputs ?? r[this.main_input_name]).dims[1]
                  , te = (await super.generate(r)).slice(null, [P, null])
                  , oe = this.sessions.image_decode
                  , {decoded_image: me} = await j(oe, {
                    generated_tokens: te
                })
                  , ve = me.add_(1).mul_(255 / 2).clamp_(0, 255).to("uint8")
                  , Ce = [];
                for (let Ge of ve) {
                    let et = v.RawImage.fromTensor(Ge);
                    Ce.push(et)
                }
                return Ce
            }
        }
        class B_ extends Y {
            constructor({char_logits: r, bpe_logits: P, wp_logits: X}) {
                super(),
                this.char_logits = r,
                this.bpe_logits = P,
                this.wp_logits = X
            }
            get logits() {
                return [this.char_logits, this.bpe_logits, this.wp_logits]
            }
        }
        class j_ extends c {
        }
        class N_ extends j_ {
            async _call(r) {
                return new B_(await super._call(r))
            }
        }
        class la extends c {
        }
        class V_ extends la {
        }
        class R_ extends la {
        }
        class ca extends c {
        }
        class z_ extends ca {
        }
        class G_ extends ca {
        }
        class W_ extends c {
            forward_params = ["input_ids", "attention_mask", "position_ids", "audio_values", "past_key_values"]
        }
        class _a extends W_ {
            _merge_input_ids_with_audio_features(r) {
                let P = r.audio_features.dims.at(-1)
                  , X = r.audio_features.view(-1, P);
                return Q({
                    audio_token_id: this.config.ignore_index ?? this.config.audio_token_id,
                    ...r,
                    audio_features: X
                })
            }
        }
        class U_ extends _a {
        }
        class br extends c {
            main_input_name = "input_values";
            forward_params = ["input_values"]
        }
        class K_ extends Y {
            constructor({audio_codes: r}) {
                super(),
                this.audio_codes = r
            }
        }
        class $_ extends Y {
            constructor({audio_values: r}) {
                super(),
                this.audio_values = r
            }
        }
        class Q_ extends br {
            async encode(r) {
                return new K_(await j(this.sessions.encoder_model, r))
            }
            async decode(r) {
                return new $_(await j(this.sessions.decoder_model, r))
            }
        }
        class X_ extends br {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "encoder_model"
                })
            }
        }
        class H_ extends br {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "decoder_model"
                })
            }
        }
        class xr extends c {
            main_input_name = "input_values";
            forward_params = ["input_values"]
        }
        class J_ extends Y {
            constructor({audio_codes: r}) {
                super(),
                this.audio_codes = r
            }
        }
        class Y_ extends Y {
            constructor({audio_values: r}) {
                super(),
                this.audio_values = r
            }
        }
        class q_ extends xr {
            async encode(r) {
                return new J_(await j(this.sessions.encoder_model, r))
            }
            async decode(r) {
                return new Y_(await j(this.sessions.decoder_model, r))
            }
        }
        class Z_ extends xr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "encoder_model"
                })
            }
        }
        class ed extends xr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "decoder_model"
                })
            }
        }
        class vr extends c {
            main_input_name = "input_values";
            forward_params = ["input_values"]
        }
        class td extends vr {
            async encode(r) {
                return await j(this.sessions.encoder_model, r)
            }
            async decode(r) {
                return await j(this.sessions.decoder_model, r)
            }
        }
        class sd extends vr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "encoder_model"
                })
            }
        }
        class rd extends vr {
            static async from_pretrained(r, P={}) {
                return super.from_pretrained(r, {
                    ...P,
                    model_file_name: P.model_file_name ?? "decoder_model"
                })
            }
        }
        class mt {
            static MODEL_CLASS_MAPPINGS = null;
            static BASE_IF_FAIL = !1;
            static async from_pretrained(r, {progress_callback: P=null, config: X=null, cache_dir: te=null, local_files_only: oe=!1, revision: me="main", model_file_name: ve=null, subfolder: Ce="onnx", device: Ge=null, dtype: et=null, use_external_data_format: tt=null, session_options: at={}}={}) {
                let He = {
                    progress_callback: P,
                    config: X,
                    cache_dir: te,
                    local_files_only: oe,
                    revision: me,
                    model_file_name: ve,
                    subfolder: Ce,
                    device: Ge,
                    dtype: et,
                    use_external_data_format: tt,
                    session_options: at
                };
                if (He.config = await l.AutoConfig.from_pretrained(r, He),
                !this.MODEL_CLASS_MAPPINGS)
                    throw new Error("`MODEL_CLASS_MAPPINGS` not implemented for this type of `AutoClass`: " + this.name);
                let ut = He.config.model_type;
                for (let Je of this.MODEL_CLASS_MAPPINGS) {
                    let Xe = Je.get(ut);
                    if (!Xe) {
                        for (let dt of Je.values())
                            if (dt[0] === ut) {
                                Xe = dt;
                                break
                            }
                        if (!Xe)
                            continue
                    }
                    return await Xe[1].from_pretrained(r, He)
                }
                if (this.BASE_IF_FAIL)
                    return Sd.has(ut) || console.warn(`Unknown model class "${ut}", attempting to construct from base class.`),
                    await c.from_pretrained(r, He);
                throw Error(`Unsupported model type: ${ut}`)
            }
        }
        let Wd = new Map([["bert", ["BertModel", Me]], ["neobert", ["NeoBertModel", ye]], ["modernbert", ["ModernBertModel", $e]], ["nomic_bert", ["NomicBertModel", Zt]], ["roformer", ["RoFormerModel", Ft]], ["electra", ["ElectraModel", B]], ["esm", ["EsmModel", vs]], ["convbert", ["ConvBertModel", Ws]], ["camembert", ["CamembertModel", Ue]], ["deberta", ["DebertaModel", ft]], ["deberta-v2", ["DebertaV2Model", Ps]], ["mpnet", ["MPNetModel", Ys]], ["albert", ["AlbertModel", ge]], ["distilbert", ["DistilBertModel", us]], ["roberta", ["RobertaModel", ar]], ["xlm", ["XLMModel", Ea]], ["xlm-roberta", ["XLMRobertaModel", La]], ["clap", ["ClapModel", __]], ["clip", ["CLIPModel", Ja]], ["clipseg", ["CLIPSegModel", ln]], ["chinese_clip", ["ChineseCLIPModel", rn]], ["siglip", ["SiglipModel", Za]], ["jina_clip", ["JinaCLIPModel", on]], ["mobilebert", ["MobileBertModel", Ke]], ["squeezebert", ["SqueezeBertModel", i]], ["wav2vec2", ["Wav2Vec2Model", Tc]], ["wav2vec2-bert", ["Wav2Vec2BertModel", jc]], ["unispeech", ["UniSpeechModel", Lc]], ["unispeech-sat", ["UniSpeechSatModel", Dc]], ["hubert", ["HubertModel", Rc]], ["wavlm", ["WavLMModel", Wc]], ["audio-spectrogram-transformer", ["ASTModel", Oa]], ["vits", ["VitsModel", ra]], ["pyannote", ["PyAnnoteModel", Fc]], ["wespeaker-resnet", ["WeSpeakerResNetModel", Sc]], ["detr", ["DetrModel", el]], ["rt_detr", ["RTDetrModel", rl]], ["rt_detr_v2", ["RTDetrV2Model", al]], ["rf_detr", ["RFDetrModel", ll]], ["d_fine", ["DFineModel", dl]], ["table-transformer", ["TableTransformerModel", pl]], ["vit", ["ViTModel", Fi]], ["ijepa", ["IJepaModel", Ci]], ["pvt", ["PvtModel", yi]], ["vit_msn", ["ViTMSNModel", Bi]], ["vit_mae", ["ViTMAEModel", Oi]], ["groupvit", ["GroupViTModel", Vi]], ["fastvit", ["FastViTModel", Ri]], ["mobilevit", ["MobileViTModel", Ui]], ["mobilevitv2", ["MobileViTV2Model", $i]], ["owlvit", ["OwlViTModel", Xi]], ["owlv2", ["Owlv2Model", Ji]], ["beit", ["BeitModel", qi]], ["deit", ["DeiTModel", hl]], ["hiera", ["HieraModel", gl]], ["convnext", ["ConvNextModel", $l]], ["convnextv2", ["ConvNextV2Model", Xl]], ["dinov2", ["Dinov2Model", Jl]], ["dinov2_with_registers", ["Dinov2WithRegistersModel", ql]], ["dinov3_vit", ["DINOv3ViTModel", tc]], ["dinov3_convnext", ["DINOv3ConvNextModel", rc]], ["resnet", ["ResNetModel", Tl]], ["swin", ["SwinModel", bl]], ["swin2sr", ["Swin2SRModel", El]], ["donut-swin", ["DonutSwinModel", Kl]], ["yolos", ["YolosModel", nc]], ["dpt", ["DPTModel", kl]], ["glpn", ["GLPNModel", Gl]], ["hifigan", ["SpeechT5HifiGan", qc]], ["efficientnet", ["EfficientNetModel", g_]], ["decision_transformer", ["DecisionTransformerModel", D_]], ["patchtst", ["PatchTSTForPrediction", V_]], ["patchtsmixer", ["PatchTSMixerForPrediction", z_]], ["mobilenet_v1", ["MobileNetV1Model", T_]], ["mobilenet_v2", ["MobileNetV2Model", x_]], ["mobilenet_v3", ["MobileNetV3Model", F_]], ["mobilenet_v4", ["MobileNetV4Model", S_]], ["maskformer", ["MaskFormerModel", Rl]], ["mgp-str", ["MgpstrForSceneTextRecognition", N_]], ["style_text_to_speech_2", ["StyleTextToSpeech2Model", Hc]]])
          , Ud = new Map([["t5", ["T5Model", _t]], ["longt5", ["LongT5Model", Vt]], ["mt5", ["MT5Model", Rt]], ["bart", ["BartModel", Xt]], ["mbart", ["MBartModel", qt]], ["marian", ["MarianModel", hc]], ["whisper", ["WhisperModel", ja]], ["m2m_100", ["M2M100Model", gc]], ["blenderbot", ["BlenderbotModel", zt]], ["blenderbot-small", ["BlenderbotSmallModel", Dt]]])
          , Kd = new Map([["mimi", ["MimiModel", Q_]], ["dac", ["DacModel", q_]], ["snac", ["SnacModel", td]]])
          , $d = new Map([["bloom", ["BloomModel", Ti]], ["jais", ["JAISModel", un]], ["gpt2", ["GPT2Model", _n]], ["gptj", ["GPTJModel", gn]], ["gpt_bigcode", ["GPTBigCodeModel", Tn]], ["gpt_neo", ["GPTNeoModel", mn]], ["gpt_neox", ["GPTNeoXModel", hn]], ["codegen", ["CodeGenModel", bn]], ["llama", ["LlamaModel", vn]], ["nanochat", ["NanoChatModel", Cn]], ["arcee", ["ArceeModel", Ln]], ["lfm2", ["Lfm2Model", yn]], ["smollm3", ["SmolLM3Model", In]], ["exaone", ["ExaoneModel", Rn]], ["olmo", ["OlmoModel", Un]], ["olmo2", ["Olmo2Model", $n]], ["mobilellm", ["MobileLLMModel", Gn]], ["granite", ["GraniteModel", Xn]], ["granitemoehybrid", ["GraniteMoeHybridModel", Jn]], ["cohere", ["CohereModel", qn]], ["gemma", ["GemmaModel", ei]], ["gemma2", ["Gemma2Model", si]], ["vaultgemma", ["VaultGemmaModel", oi]], ["gemma3_text", ["Gemma3Model", ni]], ["helium", ["HeliumModel", Bn]], ["glm", ["GlmModel", Nn]], ["openelm", ["OpenELMModel", li]], ["qwen2", ["Qwen2Model", _i]], ["qwen3", ["Qwen3Model", ui]], ["phi", ["PhiModel", hi]], ["phi3", ["Phi3Model", gi]], ["mpt", ["MptModel", bi]], ["opt", ["OPTModel", vi]], ["mistral", ["MistralModel", s_]], ["ernie4_5", ["Ernie4_5_Model", o_]], ["starcoder2", ["Starcoder2Model", n_]], ["falcon", ["FalconModel", l_]], ["stablelm", ["StableLmModel", h_]], ["modernbert-decoder", ["ModernBertDecoderModel", qe]]])
          , da = new Map([["speecht5", ["SpeechT5ForSpeechToText", Jc]], ["whisper", ["WhisperForConditionalGeneration", Ar]], ["lite-whisper", ["LiteWhisperForConditionalGeneration", Na]], ["moonshine", ["MoonshineForConditionalGeneration", Va]]])
          , od = new Map([["speecht5", ["SpeechT5ForTextToSpeech", Yc]]])
          , ad = new Map([["vits", ["VitsModel", ra]], ["musicgen", ["MusicgenForConditionalGeneration", ia]], ["supertonic", ["SupertonicForConditionalGeneration", qo]]])
          , nd = new Map([["bert", ["BertForSequenceClassification", pe]], ["neobert", ["NeoBertForSequenceClassification", Se]], ["modernbert", ["ModernBertForSequenceClassification", Ze]], ["roformer", ["RoFormerForSequenceClassification", Rs]], ["electra", ["ElectraForSequenceClassification", O]], ["esm", ["EsmForSequenceClassification", Yt]], ["convbert", ["ConvBertForSequenceClassification", Ls]], ["camembert", ["CamembertForSequenceClassification", Oe]], ["deberta", ["DebertaForSequenceClassification", ss]], ["deberta-v2", ["DebertaV2ForSequenceClassification", hs]], ["mpnet", ["MPNetForSequenceClassification", Zs]], ["albert", ["AlbertForSequenceClassification", Be]], ["distilbert", ["DistilBertForSequenceClassification", ps]], ["roberta", ["RobertaForSequenceClassification", ba]], ["xlm", ["XLMForSequenceClassification", ka]], ["xlm-roberta", ["XLMRobertaForSequenceClassification", ya]], ["bart", ["BartForSequenceClassification", xt]], ["mbart", ["MBartForSequenceClassification", gs]], ["mobilebert", ["MobileBertForSequenceClassification", Os]], ["squeezebert", ["SqueezeBertForSequenceClassification", z]]])
          , id = new Map([["bert", ["BertForTokenClassification", se]], ["neobert", ["NeoBertForTokenClassification", De]], ["modernbert", ["ModernBertForTokenClassification", Ie]], ["roformer", ["RoFormerForTokenClassification", zs]], ["electra", ["ElectraForTokenClassification", K]], ["esm", ["EsmForTokenClassification", Fe]], ["convbert", ["ConvBertForTokenClassification", nt]], ["camembert", ["CamembertForTokenClassification", lt]], ["deberta", ["DebertaForTokenClassification", Jt]], ["deberta-v2", ["DebertaV2ForTokenClassification", ys]], ["mpnet", ["MPNetForTokenClassification", er]], ["distilbert", ["DistilBertForTokenClassification", Ds]], ["roberta", ["RobertaForTokenClassification", xa]], ["xlm", ["XLMForTokenClassification", Ca]], ["xlm-roberta", ["XLMRobertaForTokenClassification", Da]]])
          , ua = new Map([["t5", ["T5ForConditionalGeneration", ot]], ["longt5", ["LongT5ForConditionalGeneration", kt]], ["mt5", ["MT5ForConditionalGeneration", is]], ["bart", ["BartForConditionalGeneration", Fs]], ["mbart", ["MBartForConditionalGeneration", ms]], ["marian", ["MarianMTModel", fc]], ["m2m_100", ["M2M100ForConditionalGeneration", Pc]], ["blenderbot", ["BlenderbotForConditionalGeneration", At]], ["blenderbot-small", ["BlenderbotSmallForConditionalGeneration", ts]]])
          , pa = new Map([["bloom", ["BloomForCausalLM", wi]], ["gpt2", ["GPT2LMHeadModel", dn]], ["jais", ["JAISLMHeadModel", pn]], ["gptj", ["GPTJForCausalLM", Pn]], ["gpt_bigcode", ["GPTBigCodeForCausalLM", wn]], ["gpt_neo", ["GPTNeoForCausalLM", Mn]], ["gpt_neox", ["GPTNeoXForCausalLM", fn]], ["codegen", ["CodeGenForCausalLM", xn]], ["llama", ["LlamaForCausalLM", En]], ["nanochat", ["NanoChatForCausalLM", Sn]], ["llama4_text", ["Llama4ForCausalLM", kn]], ["arcee", ["ArceeForCausalLM", An]], ["lfm2", ["Lfm2ForCausalLM", Dn]], ["smollm3", ["SmolLM3ForCausalLM", On]], ["exaone", ["ExaoneForCausalLM", zn]], ["olmo", ["OlmoForCausalLM", Kn]], ["olmo2", ["Olmo2ForCausalLM", Qn]], ["mobilellm", ["MobileLLMForCausalLM", Wn]], ["granite", ["GraniteForCausalLM", Hn]], ["granitemoehybrid", ["GraniteMoeHybridForCausalLM", Yn]], ["cohere", ["CohereForCausalLM", Zn]], ["gemma", ["GemmaForCausalLM", ti]], ["gemma2", ["Gemma2ForCausalLM", ri]], ["vaultgemma", ["VaultGemmaForCausalLM", ai]], ["gemma3_text", ["Gemma3ForCausalLM", ii]], ["helium", ["HeliumForCausalLM", jn]], ["glm", ["GlmForCausalLM", Vn]], ["openelm", ["OpenELMForCausalLM", ci]], ["qwen2", ["Qwen2ForCausalLM", di]], ["qwen3", ["Qwen3ForCausalLM", pi]], ["phi", ["PhiForCausalLM", fi]], ["phi3", ["Phi3ForCausalLM", Pi]], ["mpt", ["MptForCausalLM", xi]], ["opt", ["OPTForCausalLM", Ei]], ["mbart", ["MBartForCausalLM", Qt]], ["mistral", ["MistralForCausalLM", r_]], ["ernie4_5", ["Ernie4_5_ForCausalLM", a_]], ["starcoder2", ["Starcoder2ForCausalLM", i_]], ["falcon", ["FalconForCausalLM", c_]], ["trocr", ["TrOCRForCausalLM", t_]], ["stablelm", ["StableLmForCausalLM", f_]], ["modernbert-decoder", ["ModernBertDecoderForCausalLM", ht]], ["phi3_v", ["Phi3VForCausalLM", jr]]])
          , Qd = new Map([["multi_modality", ["MultiModalityCausalLM", O_]]])
          , ld = new Map([["bert", ["BertForMaskedLM", re]], ["neobert", ["NeoBertForMaskedLM", Pe]], ["modernbert", ["ModernBertForMaskedLM", ze]], ["roformer", ["RoFormerForMaskedLM", $t]], ["electra", ["ElectraForMaskedLM", w]], ["esm", ["EsmForMaskedLM", Is]], ["convbert", ["ConvBertForMaskedLM", Ye]], ["camembert", ["CamembertForMaskedLM", Qe]], ["deberta", ["DebertaForMaskedLM", es]], ["deberta-v2", ["DebertaV2ForMaskedLM", Ts]], ["mpnet", ["MPNetForMaskedLM", qs]], ["albert", ["AlbertForMaskedLM", Ne]], ["distilbert", ["DistilBertForMaskedLM", xs]], ["roberta", ["RobertaForMaskedLM", wa]], ["xlm", ["XLMWithLMHeadModel", Fa]], ["xlm-roberta", ["XLMRobertaForMaskedLM", Aa]], ["mobilebert", ["MobileBertForMaskedLM", wt]], ["squeezebert", ["SqueezeBertForMaskedLM", F]]])
          , cd = new Map([["bert", ["BertForQuestionAnswering", Te]], ["neobert", ["NeoBertForQuestionAnswering", Ve]], ["roformer", ["RoFormerForQuestionAnswering", Gs]], ["electra", ["ElectraForQuestionAnswering", ie]], ["convbert", ["ConvBertForQuestionAnswering", As]], ["camembert", ["CamembertForQuestionAnswering", ct]], ["deberta", ["DebertaForQuestionAnswering", Bt]], ["deberta-v2", ["DebertaV2ForQuestionAnswering", ws]], ["mpnet", ["MPNetForQuestionAnswering", or]], ["albert", ["AlbertForQuestionAnswering", je]], ["distilbert", ["DistilBertForQuestionAnswering", bs]], ["roberta", ["RobertaForQuestionAnswering", va]], ["xlm", ["XLMForQuestionAnswering", Sa]], ["xlm-roberta", ["XLMRobertaForQuestionAnswering", Ia]], ["mobilebert", ["MobileBertForQuestionAnswering", Es]], ["squeezebert", ["SqueezeBertForQuestionAnswering", G]]])
          , ma = new Map([["vision-encoder-decoder", ["VisionEncoderDecoderModel", Dr]], ["idefics3", ["Idefics3ForConditionalGeneration", ir]], ["smolvlm", ["SmolVLMForConditionalGeneration", Br]]])
          , _d = new Map([["llava", ["LlavaForConditionalGeneration", nr]], ["llava_onevision", ["LlavaOnevisionForConditionalGeneration", Ra]], ["moondream1", ["Moondream1ForConditionalGeneration", za]], ["florence2", ["Florence2ForConditionalGeneration", Wa]], ["qwen2-vl", ["Qwen2VLForConditionalGeneration", Mi]], ["idefics3", ["Idefics3ForConditionalGeneration", ir]], ["smolvlm", ["SmolVLMForConditionalGeneration", Br]], ["paligemma", ["PaliGemmaForConditionalGeneration", Ka]], ["llava_qwen2", ["LlavaQwen2ForCausalLM", $a]], ["gemma3n", ["Gemma3nForConditionalGeneration", Or]]])
          , dd = new Map([["ultravox", ["UltravoxModel", _a]], ["voxtral", ["VoxtralForConditionalGeneration", U_]]])
          , Xd = new Map([["vision-encoder-decoder", ["VisionEncoderDecoderModel", Dr]]])
          , ud = new Map([["vit", ["ViTForImageClassification", ki]], ["ijepa", ["IJepaForImageClassification", Si]], ["pvt", ["PvtForImageClassification", Di]], ["vit_msn", ["ViTMSNForImageClassification", ji]], ["fastvit", ["FastViTForImageClassification", zi]], ["mobilevit", ["MobileViTForImageClassification", Ki]], ["mobilevitv2", ["MobileViTV2ForImageClassification", Qi]], ["beit", ["BeitForImageClassification", Zi]], ["deit", ["DeiTForImageClassification", fl]], ["hiera", ["HieraForImageClassification", Pl]], ["convnext", ["ConvNextForImageClassification", Ql]], ["convnextv2", ["ConvNextV2ForImageClassification", Hl]], ["dinov2", ["Dinov2ForImageClassification", Yl]], ["dinov2_with_registers", ["Dinov2WithRegistersForImageClassification", Zl]], ["resnet", ["ResNetForImageClassification", wl]], ["swin", ["SwinForImageClassification", xl]], ["segformer", ["SegformerForImageClassification", m_]], ["efficientnet", ["EfficientNetForImageClassification", P_]], ["mobilenet_v1", ["MobileNetV1ForImageClassification", w_]], ["mobilenet_v2", ["MobileNetV2ForImageClassification", v_]], ["mobilenet_v3", ["MobileNetV3ForImageClassification", k_]], ["mobilenet_v4", ["MobileNetV4ForImageClassification", L_]]])
          , pd = new Map([["detr", ["DetrForObjectDetection", tl]], ["rt_detr", ["RTDetrForObjectDetection", ol]], ["rt_detr_v2", ["RTDetrV2ForObjectDetection", nl]], ["rf_detr", ["RFDetrForObjectDetection", cl]], ["d_fine", ["DFineForObjectDetection", ul]], ["table-transformer", ["TableTransformerForObjectDetection", ml]], ["yolos", ["YolosForObjectDetection", ic]]])
          , md = new Map([["owlvit", ["OwlViTForObjectDetection", Hi]], ["owlv2", ["Owlv2ForObjectDetection", Yi]], ["grounding-dino", ["GroundingDinoForObjectDetection", ac]]])
          , Qs = new Map([["detr", ["DetrForSegmentation", Lo]], ["clipseg", ["CLIPSegForImageSegmentation", cn]]])
          , Md = new Map([["segformer", ["SegformerForSemanticSegmentation", M_]], ["sapiens", ["SapiensForSemanticSegmentation", Al]], ["swin", ["SwinForSemanticSegmentation", vl]], ["mobilenet_v1", ["MobileNetV1ForSemanticSegmentation", b_]], ["mobilenet_v2", ["MobileNetV2ForSemanticSegmentation", E_]], ["mobilenet_v3", ["MobileNetV3ForSemanticSegmentation", C_]], ["mobilenet_v4", ["MobileNetV4ForSemanticSegmentation", A_]]])
          , hd = new Map([["detr", ["DetrForSegmentation", Lo]], ["maskformer", ["MaskFormerForInstanceSegmentation", zl]]])
          , fd = new Map([["sam", ["SamModel", _c]], ["sam2", ["Sam2Model", ur]], ["edgetam", ["EdgeTamModel", mc]], ["sam3_tracker", ["Sam3TrackerModel", Mc]]])
          , gd = new Map([["wav2vec2", ["Wav2Vec2ForCTC", wc]], ["wav2vec2-bert", ["Wav2Vec2BertForCTC", Nc]], ["unispeech", ["UniSpeechForCTC", Ac]], ["unispeech-sat", ["UniSpeechSatForCTC", Ic]], ["wavlm", ["WavLMForCTC", Uc]], ["hubert", ["HubertForCTC", zc]], ["parakeet_ctc", ["ParakeetForCTC", Ec]]])
          , Pd = new Map([["wav2vec2", ["Wav2Vec2ForSequenceClassification", bc]], ["wav2vec2-bert", ["Wav2Vec2BertForSequenceClassification", Vc]], ["unispeech", ["UniSpeechForSequenceClassification", yc]], ["unispeech-sat", ["UniSpeechSatForSequenceClassification", Oc]], ["wavlm", ["WavLMForSequenceClassification", Kc]], ["hubert", ["HubertForSequenceClassification", Gc]], ["audio-spectrogram-transformer", ["ASTForAudioClassification", Ba]]])
          , Td = new Map([["wavlm", ["WavLMForXVector", $c]]])
          , wd = new Map([["unispeech-sat", ["UniSpeechSatForAudioFrameClassification", Bc]], ["wavlm", ["WavLMForAudioFrameClassification", Qc]], ["wav2vec2", ["Wav2Vec2ForAudioFrameClassification", xc]], ["pyannote", ["PyAnnoteForAudioFrameClassification", kc]]])
          , bd = new Map([["vitmatte", ["VitMatteForImageMatting", Wi]]])
          , Hd = new Map([["patchtst", ["PatchTSTForPrediction", R_]], ["patchtsmixer", ["PatchTSMixerForPrediction", G_]]])
          , xd = new Map([["swin2sr", ["Swin2SRForImageSuperResolution", Fl]]])
          , vd = new Map([["dpt", ["DPTForDepthEstimation", Cl]], ["depth_anything", ["DepthAnythingForDepthEstimation", Ll]], ["glpn", ["GLPNForDepthEstimation", Wl]], ["sapiens", ["SapiensForDepthEstimation", yl]], ["depth_pro", ["DepthProForDepthEstimation", Ol]], ["metric3d", ["Metric3DForDepthEstimation", jl]], ["metric3dv2", ["Metric3Dv2ForDepthEstimation", Vl]]])
          , Ed = new Map([["sapiens", ["SapiensForNormalEstimation", Dl]]])
          , Fd = new Map([["vitpose", ["VitPoseForPoseEstimation", Ai]]])
          , kd = new Map([["clip", ["CLIPVisionModelWithProjection", qa]], ["siglip", ["SiglipVisionModel", tn]], ["jina_clip", ["JinaCLIPVisionModel", nn]]])
          , Cd = [[Wd, p.EncoderOnly], [Ud, p.EncoderDecoder], [$d, p.DecoderOnly], [Kd, p.AutoEncoder], [nd, p.EncoderOnly], [id, p.EncoderOnly], [ua, p.Seq2Seq], [da, p.Seq2Seq], [pa, p.DecoderOnly], [Qd, p.MultiModality], [ld, p.EncoderOnly], [cd, p.EncoderOnly], [ma, p.Vision2Seq], [_d, p.ImageTextToText], [dd, p.AudioTextToText], [ud, p.EncoderOnly], [Qs, p.EncoderOnly], [hd, p.EncoderOnly], [Md, p.EncoderOnly], [bd, p.EncoderOnly], [Hd, p.EncoderOnly], [xd, p.EncoderOnly], [vd, p.EncoderOnly], [Ed, p.EncoderOnly], [Fd, p.EncoderOnly], [pd, p.EncoderOnly], [md, p.EncoderOnly], [fd, p.MaskGeneration], [gd, p.EncoderOnly], [Pd, p.EncoderOnly], [od, p.Seq2Seq], [ad, p.EncoderOnly], [Td, p.EncoderOnly], [wd, p.EncoderOnly], [kd, p.EncoderOnly]];
        for (let[s,r] of Cd)
            for (let[P,X] of s.values())
                m.set(P, r),
                o.set(X, P),
                E.set(P, X);
        let Jd = [["MusicgenForConditionalGeneration", ia, p.Musicgen], ["Phi3VForCausalLM", jr, p.Phi3V], ["CLIPTextModelWithProjection", Ya, p.EncoderOnly], ["SiglipTextModel", en, p.EncoderOnly], ["JinaCLIPTextModel", an, p.EncoderOnly], ["ClapTextModelWithProjection", d_, p.EncoderOnly], ["ClapAudioModelWithProjection", u_, p.EncoderOnly], ["DacEncoderModel", Z_, p.EncoderOnly], ["DacDecoderModel", ed, p.EncoderOnly], ["MimiEncoderModel", X_, p.EncoderOnly], ["MimiDecoderModel", H_, p.EncoderOnly], ["SnacEncoderModel", sd, p.EncoderOnly], ["SnacDecoderModel", rd, p.EncoderOnly], ["Gemma3nForConditionalGeneration", Or, p.ImageAudioTextToText], ["SupertonicForConditionalGeneration", qo, p.Supertonic]];
        for (let[s,r,P] of Jd)
            m.set(s, P),
            o.set(r, s),
            E.set(s, r);
        let Sd = new Map([["modnet", Qs], ["birefnet", Qs], ["isnet", Qs], ["ben", Qs]]);
        for (let[s,r] of Sd.entries())
            r.set(s, ["PreTrainedModel", c]),
            m.set(s, p.EncoderOnly),
            o.set(c, s),
            E.set(s, c);
        class Yd extends mt {
            static MODEL_CLASS_MAPPINGS = Cd.map(r => r[0]);
            static BASE_IF_FAIL = !0
        }
        class qd extends mt {
            static MODEL_CLASS_MAPPINGS = [nd]
        }
        class Zd extends mt {
            static MODEL_CLASS_MAPPINGS = [id]
        }
        class eu extends mt {
            static MODEL_CLASS_MAPPINGS = [ua]
        }
        class tu extends mt {
            static MODEL_CLASS_MAPPINGS = [da]
        }
        class su extends mt {
            static MODEL_CLASS_MAPPINGS = [od]
        }
        class ru extends mt {
            static MODEL_CLASS_MAPPINGS = [ad]
        }
        class ou extends mt {
            static MODEL_CLASS_MAPPINGS = [pa]
        }
        class au extends mt {
            static MODEL_CLASS_MAPPINGS = [ld]
        }
        class nu extends mt {
            static MODEL_CLASS_MAPPINGS = [cd]
        }
        class iu extends mt {
            static MODEL_CLASS_MAPPINGS = [ma]
        }
        class lu extends mt {
            static MODEL_CLASS_MAPPINGS = [ud]
        }
        class cu extends mt {
            static MODEL_CLASS_MAPPINGS = [Qs]
        }
        class _u extends mt {
            static MODEL_CLASS_MAPPINGS = [Md]
        }
        class du extends mt {
            static MODEL_CLASS_MAPPINGS = [hd]
        }
        class uu extends mt {
            static MODEL_CLASS_MAPPINGS = [pd]
        }
        class pu extends mt {
            static MODEL_CLASS_MAPPINGS = [md]
        }
        class mu extends mt {
            static MODEL_CLASS_MAPPINGS = [fd]
        }
        class Mu extends mt {
            static MODEL_CLASS_MAPPINGS = [gd]
        }
        class hu extends mt {
            static MODEL_CLASS_MAPPINGS = [Pd]
        }
        class fu extends mt {
            static MODEL_CLASS_MAPPINGS = [Td]
        }
        class gu extends mt {
            static MODEL_CLASS_MAPPINGS = [wd]
        }
        class Pu extends mt {
            static MODEL_CLASS_MAPPINGS = [Xd]
        }
        class Tu extends mt {
            static MODEL_CLASS_MAPPINGS = [bd]
        }
        class wu extends mt {
            static MODEL_CLASS_MAPPINGS = [xd]
        }
        class bu extends mt {
            static MODEL_CLASS_MAPPINGS = [vd]
        }
        class xu extends mt {
            static MODEL_CLASS_MAPPINGS = [Ed]
        }
        class vu extends mt {
            static MODEL_CLASS_MAPPINGS = [Fd]
        }
        class Eu extends mt {
            static MODEL_CLASS_MAPPINGS = [kd]
        }
        class Fu extends mt {
            static MODEL_CLASS_MAPPINGS = [_d]
        }
        class ku extends mt {
            static MODEL_CLASS_MAPPINGS = [dd]
        }
        class Cu extends Y {
            constructor({logits: r, past_key_values: P, encoder_outputs: X, decoder_attentions: te=null, cross_attentions: oe=null}) {
                super(),
                this.logits = r,
                this.past_key_values = P,
                this.encoder_outputs = X,
                this.decoder_attentions = te,
                this.cross_attentions = oe
            }
        }
        class rt extends Y {
            constructor({logits: r, ...P}) {
                super(),
                this.logits = r;
                let X = Object.values(P);
                X.length > 0 && (this.attentions = X)
            }
        }
        class Ld extends Y {
            constructor({logits: r, embeddings: P}) {
                super(),
                this.logits = r,
                this.embeddings = P
            }
        }
        class It extends Y {
            constructor({logits: r}) {
                super(),
                this.logits = r
            }
        }
        class jt extends Y {
            constructor({logits: r}) {
                super(),
                this.logits = r
            }
        }
        class Ut extends Y {
            constructor({start_logits: r, end_logits: P}) {
                super(),
                this.start_logits = r,
                this.end_logits = P
            }
        }
        class Cs extends Y {
            constructor({logits: r}) {
                super(),
                this.logits = r
            }
        }
        class Su extends Y {
            constructor({logits: r, past_key_values: P}) {
                super(),
                this.logits = r,
                this.past_key_values = P
            }
        }
        class Ad extends Y {
            constructor({alphas: r}) {
                super(),
                this.alphas = r
            }
        }
        class yd extends Y {
            constructor({waveform: r, spectrogram: P}) {
                super(),
                this.waveform = r,
                this.spectrogram = P
            }
        }
    }
    ),
    "./src/models/audio_spectrogram_transformer/feature_extraction_audio_spectrogram_transformer.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ASTFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        class R extends l.FeatureExtractor {
            constructor(M) {
                super(M);
                let f = this.config.sampling_rate
                  , L = (0,
                b.mel_filter_bank)(257, this.config.num_mel_bins, 20, Math.floor(f / 2), f, null, "kaldi", !0);
                this.mel_filters = L,
                this.window = (0,
                b.window_function)(400, "hann", {
                    periodic: !1
                }),
                this.mean = this.config.mean,
                this.std = this.config.std
            }
            async _extract_fbank_features(M, f) {
                return (0,
                b.spectrogram)(M, this.window, 400, 160, {
                    fft_length: 512,
                    power: 2,
                    center: !1,
                    preemphasis: .97,
                    mel_filters: this.mel_filters,
                    log_mel: "log",
                    mel_floor: 1192092955078125e-22,
                    remove_dc_offset: !0,
                    max_num_frames: f,
                    transpose: !0
                })
            }
            async _call(M) {
                (0,
                l.validate_audio_inputs)(M, "ASTFeatureExtractor");
                let f = await this._extract_fbank_features(M, this.config.max_length);
                if (this.config.do_normalize) {
                    let L = this.std * 2
                      , _ = f.data;
                    for (let a = 0; a < _.length; ++a)
                        _[a] = (_[a] - this.mean) / L
                }
                return {
                    input_values: f.unsqueeze_(0)
                }
            }
        }
    }
    ),
    "./src/models/auto/feature_extraction_auto.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AutoFeatureExtractor: () => C
        });
        var l = e("./src/utils/constants.js")
          , h = e("./src/utils/hub.js")
          , b = e("./src/base/feature_extraction_utils.js")
          , R = e("./src/models/feature_extractors.js");
        class C {
            static async from_pretrained(f, L={}) {
                let _ = await (0,
                h.getModelJSON)(f, l.FEATURE_EXTRACTOR_NAME, !0, L)
                  , a = _.feature_extractor_type
                  , v = R[a];
                if (!v)
                    throw new Error(`Unknown feature_extractor_type: '${a}'. Please report this at ${l.GITHUB_ISSUE_URL}.`);
                return new v(_)
            }
        }
    }
    ),
    "./src/models/auto/image_processing_auto.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AutoImageProcessor: () => C
        });
        var l = e("./src/utils/constants.js")
          , h = e("./src/utils/hub.js")
          , b = e("./src/base/image_processors_utils.js")
          , R = e("./src/models/image_processors.js");
        class C {
            static async from_pretrained(f, L={}) {
                let _ = await (0,
                h.getModelJSON)(f, l.IMAGE_PROCESSOR_NAME, !0, L)
                  , a = _.image_processor_type ?? _.feature_extractor_type
                  , v = R[a?.replace(/Fast$/, "")];
                return v || (a !== void 0 && console.warn(`Image processor type '${a}' not found, assuming base ImageProcessor. Please report this at ${l.GITHUB_ISSUE_URL}.`),
                v = b.ImageProcessor),
                new v(_)
            }
        }
    }
    ),
    "./src/models/auto/processing_auto.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AutoProcessor: () => f
        });
        var l = e("./src/utils/constants.js")
          , h = e("./src/utils/hub.js")
          , b = e("./src/base/processing_utils.js")
          , R = e("./src/models/processors.js")
          , C = e("./src/models/image_processors.js")
          , M = e("./src/models/feature_extractors.js");
        class f {
            static async from_pretrained(_, a={}) {
                let v = await (0,
                h.getModelJSON)(_, l.IMAGE_PROCESSOR_NAME, !0, a)
                  , {image_processor_type: g, feature_extractor_type: y, processor_class: W} = v;
                if (W && R[W])
                    return R[W].from_pretrained(_, a);
                if (!g && !y)
                    throw new Error("No `image_processor_type` or `feature_extractor_type` found in the config.");
                let T = {};
                if (g) {
                    let I = C[g.replace(/Fast$/, "")];
                    if (!I)
                        throw new Error(`Unknown image_processor_type: '${g}'.`);
                    T.image_processor = new I(v)
                }
                if (y) {
                    let I = C[y];
                    if (I)
                        T.image_processor = new I(v);
                    else {
                        let p = M[y];
                        if (!p)
                            throw new Error(`Unknown feature_extractor_type: '${y}'.`);
                        T.feature_extractor = new p(v)
                    }
                }
                let k = {};
                return new b.Processor(k,T,null)
            }
        }
    }
    ),
    "./src/models/beit/image_processing_beit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            BeitFeatureExtractor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/bit/image_processing_bit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            BitImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/chinese_clip/image_processing_chinese_clip.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ChineseCLIPFeatureExtractor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/clap/feature_extraction_clap.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ClapFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        class R extends l.FeatureExtractor {
            constructor(M) {
                super(M),
                this.mel_filters = (0,
                b.mel_filter_bank)(this.config.nb_frequency_bins, this.config.feature_size, this.config.frequency_min, this.config.frequency_max, this.config.sampling_rate, null, "htk"),
                this.mel_filters_slaney = (0,
                b.mel_filter_bank)(this.config.nb_frequency_bins, this.config.feature_size, this.config.frequency_min, this.config.frequency_max, this.config.sampling_rate, "slaney", "slaney"),
                this.window = (0,
                b.window_function)(this.config.fft_window_size, "hann")
            }
            async _get_input_mel(M, f, L, _) {
                let a, v = !1, g = M.length - f;
                if (g > 0)
                    if (L === "rand_trunc") {
                        v = !0;
                        let y = Math.floor(Math.random() * (g + 1));
                        M = M.subarray(y, y + f),
                        a = await this._extract_fbank_features(M, this.mel_filters_slaney, this.config.nb_max_samples)
                    } else
                        throw new Error(`Truncation strategy "${L}" not implemented`);
                else {
                    if (g < 0) {
                        let y = new Float64Array(f);
                        if (y.set(M),
                        _ === "repeat")
                            for (let W = M.length; W < f; W += M.length)
                                y.set(M.subarray(0, Math.min(M.length, f - W)), W);
                        else if (_ === "repeatpad")
                            for (let W = M.length; W < -g; W += M.length)
                                y.set(M, W);
                        M = y
                    }
                    if (L === "fusion")
                        throw new Error(`Truncation strategy "${L}" not implemented`);
                    a = await this._extract_fbank_features(M, this.mel_filters_slaney, this.config.nb_max_samples)
                }
                return a.unsqueeze_(0)
            }
            async _extract_fbank_features(M, f, L=null) {
                return (0,
                b.spectrogram)(M, this.window, this.config.fft_window_size, this.config.hop_length, {
                    power: 2,
                    mel_filters: f,
                    log_mel: "dB",
                    max_num_frames: L,
                    do_pad: !1,
                    transpose: !0
                })
            }
            async _call(M, {max_length: f=null}={}) {
                return (0,
                l.validate_audio_inputs)(M, "ClapFeatureExtractor"),
                {
                    input_features: (await this._get_input_mel(M, f ?? this.config.nb_max_samples, this.config.truncation, this.config.padding)).unsqueeze_(0)
                }
            }
        }
    }
    ),
    "./src/models/clip/image_processing_clip.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            CLIPFeatureExtractor: () => b,
            CLIPImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/convnext/image_processing_convnext.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ConvNextFeatureExtractor: () => b,
            ConvNextImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            constructor(C) {
                super(C),
                this.crop_pct = this.config.crop_pct ?? 224 / 256
            }
            async resize(C) {
                let M = this.size?.shortest_edge;
                if (M === void 0)
                    throw new Error("Size dictionary must contain 'shortest_edge' key.");
                if (M < 384) {
                    let f = Math.floor(M / this.crop_pct)
                      , [L,_] = this.get_resize_output_image_size(C, {
                        shortest_edge: f
                    });
                    C = await C.resize(L, _, {
                        resample: this.resample
                    }),
                    C = await C.center_crop(M, M)
                } else
                    C = await C.resize(M, M, {
                        resample: this.resample
                    });
                return C
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/models/dac/feature_extraction_dac.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DacFeatureExtractor: () => h
        });
        var l = e("./src/models/encodec/feature_extraction_encodec.js");
        class h extends l.EncodecFeatureExtractor {
        }
    }
    ),
    "./src/models/deit/image_processing_deit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DeiTFeatureExtractor: () => b,
            DeiTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/detr/image_processing_detr.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DetrFeatureExtractor: () => R,
            DetrImageProcessor: () => b
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.ImageProcessor {
            async _call(M) {
                let f = await super._call(M)
                  , L = [f.pixel_values.dims[0], 64, 64]
                  , _ = (0,
                h.full)(L, 1n);
                return {
                    ...f,
                    pixel_mask: _
                }
            }
            post_process_object_detection(...M) {
                return (0,
                l.post_process_object_detection)(...M)
            }
            post_process_panoptic_segmentation(...M) {
                return (0,
                l.post_process_panoptic_segmentation)(...M)
            }
            post_process_instance_segmentation(...M) {
                return (0,
                l.post_process_instance_segmentation)(...M)
            }
        }
        class R extends b {
        }
    }
    ),
    "./src/models/dinov3_vit/image_processing_dinov3_vit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DINOv3ViTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/donut/image_processing_donut.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DonutFeatureExtractor: () => b,
            DonutImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            pad_image(C, M, f, L={}) {
                let[_,a,v] = M
                  , g = this.image_mean;
                Array.isArray(this.image_mean) || (g = new Array(v).fill(g));
                let y = this.image_std;
                Array.isArray(y) || (y = new Array(v).fill(g));
                let W = g.map( (T, k) => -T / y[k]);
                return super.pad_image(C, M, f, {
                    center: !0,
                    constant_values: W,
                    ...L
                })
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/models/dpt/image_processing_dpt.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DPTFeatureExtractor: () => b,
            DPTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/efficientnet/image_processing_efficientnet.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            EfficientNetImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            constructor(R) {
                super(R),
                this.include_top = this.config.include_top ?? !0,
                this.include_top && (this.image_std = this.image_std.map(C => C * C))
            }
        }
    }
    ),
    "./src/models/encodec/feature_extraction_encodec.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            EncodecFeatureExtractor: () => b
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.FeatureExtractor {
            async _call(C) {
                (0,
                l.validate_audio_inputs)(C, "EncodecFeatureExtractor"),
                C instanceof Float64Array && (C = new Float32Array(C));
                let M = this.config.feature_size;
                if (C.length % M !== 0)
                    throw new Error(`The length of the audio data must be a multiple of the number of channels (${M}).`);
                let f = [1, M, C.length / M];
                return {
                    input_values: new h.Tensor("float32",C,f)
                }
            }
        }
    }
    ),
    "./src/models/feature_extractors.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ASTFeatureExtractor: () => l.ASTFeatureExtractor,
            ClapFeatureExtractor: () => b.ClapFeatureExtractor,
            DacFeatureExtractor: () => R.DacFeatureExtractor,
            EncodecFeatureExtractor: () => h.EncodecFeatureExtractor,
            Gemma3nAudioFeatureExtractor: () => C.Gemma3nAudioFeatureExtractor,
            ImageFeatureExtractor: () => T.ImageProcessor,
            MoonshineFeatureExtractor: () => M.MoonshineFeatureExtractor,
            ParakeetFeatureExtractor: () => f.ParakeetFeatureExtractor,
            PyAnnoteFeatureExtractor: () => L.PyAnnoteFeatureExtractor,
            SeamlessM4TFeatureExtractor: () => _.SeamlessM4TFeatureExtractor,
            SnacFeatureExtractor: () => a.SnacFeatureExtractor,
            SpeechT5FeatureExtractor: () => v.SpeechT5FeatureExtractor,
            Wav2Vec2FeatureExtractor: () => g.Wav2Vec2FeatureExtractor,
            WeSpeakerFeatureExtractor: () => y.WeSpeakerFeatureExtractor,
            WhisperFeatureExtractor: () => W.WhisperFeatureExtractor
        });
        var l = e("./src/models/audio_spectrogram_transformer/feature_extraction_audio_spectrogram_transformer.js")
          , h = e("./src/models/encodec/feature_extraction_encodec.js")
          , b = e("./src/models/clap/feature_extraction_clap.js")
          , R = e("./src/models/dac/feature_extraction_dac.js")
          , C = e("./src/models/gemma3n/feature_extraction_gemma3n.js")
          , M = e("./src/models/moonshine/feature_extraction_moonshine.js")
          , f = e("./src/models/parakeet/feature_extraction_parakeet.js")
          , L = e("./src/models/pyannote/feature_extraction_pyannote.js")
          , _ = e("./src/models/seamless_m4t/feature_extraction_seamless_m4t.js")
          , a = e("./src/models/snac/feature_extraction_snac.js")
          , v = e("./src/models/speecht5/feature_extraction_speecht5.js")
          , g = e("./src/models/wav2vec2/feature_extraction_wav2vec2.js")
          , y = e("./src/models/wespeaker/feature_extraction_wespeaker.js")
          , W = e("./src/models/whisper/feature_extraction_whisper.js")
          , T = e("./src/base/image_processors_utils.js")
    }
    ),
    "./src/models/florence2/processing_florence2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Florence2Processor: () => R
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js");
        class R extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            constructor(M, f, L) {
                super(M, f, L);
                let {tasks_answer_post_processing_type: _, task_prompts_without_inputs: a, task_prompts_with_input: v} = this.image_processor.config;
                this.tasks_answer_post_processing_type = new Map(Object.entries(_ ?? {})),
                this.task_prompts_without_inputs = new Map(Object.entries(a ?? {})),
                this.task_prompts_with_input = new Map(Object.entries(v ?? {})),
                this.regexes = {
                    quad_boxes: /(.+?)<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/gm,
                    bboxes: /([^<]+)?<loc_(\d+)><loc_(\d+)><loc_(\d+)><loc_(\d+)>/gm
                },
                this.size_per_bin = 1e3
            }
            construct_prompts(M) {
                typeof M == "string" && (M = [M]);
                let f = [];
                for (let L of M)
                    if (this.task_prompts_without_inputs.has(L))
                        f.push(this.task_prompts_without_inputs.get(L));
                    else {
                        for (let[_,a] of this.task_prompts_with_input)
                            if (L.includes(_)) {
                                f.push(a.replaceAll("{input}", L).replaceAll(_, ""));
                                break
                            }
                        f.length !== M.length && f.push(L)
                    }
                return f
            }
            post_process_generation(M, f, L) {
                let _ = this.tasks_answer_post_processing_type.get(f) ?? "pure_text";
                M = M.replaceAll("<s>", "").replaceAll("</s>", "");
                let a;
                switch (_) {
                case "pure_text":
                    a = M;
                    break;
                case "description_with_bboxes":
                case "bboxes":
                case "phrase_grounding":
                case "ocr":
                    let v = _ === "ocr" ? "quad_boxes" : "bboxes"
                      , g = M.matchAll(this.regexes[v])
                      , y = []
                      , W = [];
                    for (let[T,k,...I] of g)
                        y.push(k ? k.trim() : y.at(-1) ?? ""),
                        W.push(I.map( (p, m) => (Number(p) + .5) / this.size_per_bin * L[m % 2]));
                    a = {
                        labels: y,
                        [v]: W
                    };
                    break;
                default:
                    throw new Error(`Task "${f}" (of type "${_}") not yet implemented.`)
                }
                return {
                    [f]: a
                }
            }
            async _call(M, f=null, L={}) {
                if (!M && !f)
                    throw new Error("Either text or images must be provided");
                let _ = await this.image_processor(M, L)
                  , a = f ? this.tokenizer(this.construct_prompts(f), L) : {};
                return {
                    ..._,
                    ...a
                }
            }
        }
    }
    ),
    "./src/models/gemma3n/feature_extraction_gemma3n.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Gemma3nAudioFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        class R extends l.FeatureExtractor {
            constructor(M) {
                super(M);
                let {fft_length: f, feature_size: L, min_frequency: _, max_frequency: a, sampling_rate: v, frame_length: g} = this.config
                  , y = (0,
                b.mel_filter_bank)(Math.floor(1 + f / 2), L, _, a, v, null, "htk", !1);
                this.mel_filters = y,
                this.window = (0,
                b.window_function)(g, "hann")
            }
            async _extract_fbank_features(M, f) {
                return (0,
                b.spectrogram)(M, this.window, this.config.frame_length, this.config.hop_length, {
                    fft_length: this.config.fft_length,
                    center: !1,
                    onesided: !0,
                    preemphasis: this.config.preemphasis,
                    preemphasis_htk_flavor: this.config.preemphasis_htk_flavor,
                    mel_filters: this.mel_filters,
                    log_mel: "log",
                    mel_floor: this.config.mel_floor,
                    remove_dc_offset: !1,
                    transpose: !0
                })
            }
            async _call(M, {max_length: f=48e4, truncation: L=!0, padding: _=!0, pad_to_multiple_of: a=128}={}) {
                if ((0,
                l.validate_audio_inputs)(M, "Gemma3nAudioFeatureExtractor"),
                L && M.length > f && (M = M.slice(0, f)),
                _ && M.length % a !== 0) {
                    let y = a - M.length % a
                      , W = new Float64Array(M.length + y);
                    W.set(M),
                    this.config.padding_value !== 0 && W.fill(this.config.padding_value, M.length),
                    M = W
                }
                let v = await this._extract_fbank_features(M, this.config.max_length)
                  , g = (0,
                h.full)([1, v.dims[0]], !0);
                return {
                    input_features: v.unsqueeze_(0),
                    input_features_mask: g
                }
            }
        }
    }
    ),
    "./src/models/gemma3n/processing_gemma3n.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Gemma3nProcessor: () => f
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/models/auto/feature_extraction_auto.js")
          , R = e("./src/tokenizers.js")
          , C = e("./src/utils/image.js")
          , M = e("./src/utils/audio.js");
        class f extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            static feature_extractor_class = b.AutoFeatureExtractor;
            static tokenizer_class = R.AutoTokenizer;
            static uses_processor_config = !0;
            static uses_chat_template_file = !0;
            constructor(_, a, v) {
                super(_, a, v),
                this.audio_seq_length = this.config.audio_seq_length,
                this.image_seq_length = this.config.image_seq_length;
                let {audio_token_id: g, boa_token: y, audio_token: W, eoa_token: T, image_token_id: k, boi_token: I, image_token: p, eoi_token: m} = this.tokenizer.config;
                this.audio_token_id = g,
                this.boa_token = y,
                this.audio_token = W;
                let E = W.repeat(this.audio_seq_length);
                this.full_audio_sequence = `

${y}${E}${T}

`,
                this.image_token_id = k,
                this.boi_token = I,
                this.image_token = p;
                let o = p.repeat(this.image_seq_length);
                this.full_image_sequence = `

${I}${o}${m}

`
            }
            async _call(_, a=null, v=null, g={}) {
                typeof _ == "string" && (_ = [_]);
                let y;
                v && (y = await this.feature_extractor(v, g),
                _ = _.map(k => k.replaceAll(this.audio_token, this.full_audio_sequence)));
                let W;
                return a && (W = await this.image_processor(a, g),
                _ = _.map(k => k.replaceAll(this.image_token, this.full_image_sequence))),
                {
                    ...this.tokenizer(_, g),
                    ...W,
                    ...y
                }
            }
        }
    }
    ),
    "./src/models/glpn/image_processing_glpn.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            GLPNFeatureExtractor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/grounding_dino/image_processing_grounding_dino.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            GroundingDinoImageProcessor: () => b
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.ImageProcessor {
            async _call(C) {
                let M = await super._call(C)
                  , f = M.pixel_values.dims
                  , L = (0,
                h.ones)([f[0], f[2], f[3]]);
                return {
                    ...M,
                    pixel_mask: L
                }
            }
        }
    }
    ),
    "./src/models/grounding_dino/processing_grounding_dino.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            GroundingDinoProcessor: () => M
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/base/image_processors_utils.js");
        function C(f, L) {
            let a = f.dims.at(-1) - 1
              , v = f.tolist();
            v.fill(!1, 0, 1),
            v.fill(!1, a);
            let g = L.tolist();
            return v.map( (y, W) => y ? W : null).filter(y => y !== null).map(y => g[y])
        }
        class M extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            async _call(L, _, a={}) {
                let v = L ? await this.image_processor(L, a) : {};
                return {
                    ..._ ? this.tokenizer(_, a) : {},
                    ...v
                }
            }
            post_process_grounded_object_detection(L, _, {box_threshold: a=.25, text_threshold: v=.25, target_sizes: g=null}={}) {
                let {logits: y, pred_boxes: W} = L
                  , T = y.dims[0];
                if (g !== null && g.length !== T)
                    throw Error("Make sure that you pass in as many target sizes as the batch dimension of the logits");
                let k = y.dims.at(1)
                  , I = y.sigmoid()
                  , p = I.max(-1).tolist()
                  , m = W.tolist().map(o => o.map(d => (0,
                R.center_to_corners_format)(d)))
                  , E = [];
                for (let o = 0; o < T; ++o) {
                    let d = g !== null ? g[o] : null;
                    d !== null && (m[o] = m[o].map(D => D.map( ($, U) => $ * d[(U + 1) % 2])));
                    let x = p[o]
                      , S = []
                      , N = []
                      , j = [];
                    for (let D = 0; D < k; ++D) {
                        let $ = x[D];
                        if ($ <= a)
                            continue;
                        let U = m[o][D]
                          , H = I[o][D];
                        S.push($),
                        j.push(U);
                        let Z = C(H.gt(v), _[o]);
                        N.push(Z)
                    }
                    E.push({
                        scores: S,
                        boxes: j,
                        labels: this.batch_decode(N)
                    })
                }
                return E
            }
        }
    }
    ),
    "./src/models/idefics3/image_processing_idefics3.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Idefics3ImageProcessor: () => b
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.ImageProcessor {
            constructor(C) {
                super(C),
                this.do_image_splitting = C.do_image_splitting ?? !0,
                this.max_image_size = C.max_image_size
            }
            get_resize_for_vision_encoder(C, M) {
                let[f,L] = C.dims.slice(-2)
                  , _ = L / f;
                return L >= f ? (L = Math.ceil(L / M) * M,
                f = Math.floor(L / _),
                f = Math.ceil(f / M) * M) : (f = Math.ceil(f / M) * M,
                L = Math.floor(f * _),
                L = Math.ceil(L / M) * M),
                {
                    height: f,
                    width: L
                }
            }
            async _call(C, {do_image_splitting: M=null, return_row_col_info: f=!1}={}) {
                let L;
                if (!Array.isArray(C))
                    L = [[C]];
                else {
                    if (C.length === 0 || !C[0])
                        throw new Error("No images provided.");
                    Array.isArray(C[0]) ? L = C : L = [C]
                }
                let _ = []
                  , a = []
                  , v = []
                  , g = []
                  , y = [];
                for (let o of L) {
                    let d = await Promise.all(o.map(N => this.preprocess(N)));
                    g.push(...d.map(N => N.original_size)),
                    y.push(...d.map(N => N.reshaped_input_size)),
                    d.forEach(N => N.pixel_values.unsqueeze_(0));
                    let {longest_edge: x} = this.max_image_size, S;
                    if (M ?? this.do_image_splitting) {
                        let N = new Array(d.length)
                          , j = new Array(d.length);
                        S = await Promise.all(d.map(async (D, $) => {
                            let U = this.get_resize_for_vision_encoder(D.pixel_values, x)
                              , H = await (0,
                            h.interpolate_4d)(D.pixel_values, {
                                size: [U.height, U.width]
                            })
                              , {frames: Z, num_splits_h: ee, num_splits_w: le} = await this.split_image(H, this.max_image_size);
                            return N[$] = ee,
                            j[$] = le,
                            (0,
                            h.cat)(Z, 0)
                        }
                        )),
                        a.push(N),
                        v.push(j)
                    } else {
                        let N = [x, x];
                        S = await Promise.all(d.map(j => (0,
                        h.interpolate_4d)(j.pixel_values, {
                            size: N
                        }))),
                        a.push(new Array(d.length).fill(0)),
                        v.push(new Array(d.length).fill(0))
                    }
                    _.push((0,
                    h.cat)(S, 0))
                }
                let W = _.length, [T,k,I,p] = _[0].dims, m, E;
                if (W === 1)
                    m = _[0].unsqueeze_(0),
                    E = (0,
                    h.full)([W, T, I, p], !0);
                else {
                    let o = Math.max(..._.map(S => S.dims.at(0)));
                    E = (0,
                    h.full)([W, o, I, p], !0);
                    let d = E.data
                      , x = o * I * p;
                    for (let S = 0; S < W; ++S) {
                        let N = _[S].dims[0];
                        if (N < o) {
                            _[S] = (0,
                            h.cat)([_[S], (0,
                            h.full)([o - N, k, I, p], 0)], 0);
                            let j = S * x + N * I * p
                              , D = (S + 1) * x;
                            d.fill(!1, j, D)
                        }
                    }
                    m = (0,
                    h.stack)(_, 0)
                }
                return {
                    pixel_values: m,
                    pixel_attention_mask: E,
                    original_sizes: g,
                    reshaped_input_sizes: y,
                    ...f ? {
                        rows: a,
                        cols: v
                    } : {}
                }
            }
            async split_image(C, {longest_edge: M}) {
                let f = M
                  , L = M
                  , _ = []
                  , [a,v] = C.dims.slice(-2)
                  , g = 0
                  , y = 0;
                if (a > f || v > L) {
                    g = Math.ceil(a / f),
                    y = Math.ceil(v / L);
                    let W = Math.ceil(a / g)
                      , T = Math.ceil(v / y);
                    for (let p = 0; p < g; ++p)
                        for (let m = 0; m < y; ++m) {
                            let E, o, d, x;
                            p === g - 1 ? (o = a - W,
                            x = a) : (o = p * W,
                            x = (p + 1) * W),
                            m === y - 1 ? (E = v - T,
                            d = v) : (E = m * T,
                            d = (m + 1) * T);
                            let S = [o, E]
                              , N = [x, d]
                              , j = await (0,
                            h.slice)(C, S, N, [2, 3]);
                            _.push(j)
                        }
                    let k = f
                      , I = L;
                    (a !== k || v !== I) && (C = await (0,
                    h.interpolate_4d)(C, {
                        size: [k, I]
                    }))
                }
                return _.push(C),
                {
                    frames: _,
                    num_splits_h: g,
                    num_splits_w: y
                }
            }
        }
    }
    ),
    "./src/models/idefics3/processing_idefics3.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Idefics3Processor: () => _
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/utils/image.js")
          , C = e("./src/utils/core.js");
        function M(a, v, g, y, W, T) {
            let k = "";
            for (let I = 0; I < v; ++I) {
                for (let p = 0; p < g; ++p)
                    k += y + `<row_${I + 1}_col_${p + 1}>` + W.repeat(a);
                k += `
`
            }
            return k += `
${y}${T}` + W.repeat(a) + `${y}`,
            k
        }
        function f(a, v, g, y) {
            return `${v}${y}` + g.repeat(a) + `${v}`
        }
        function L(a, v, g, y, W, T) {
            return a === 0 && v === 0 ? f(g, y, W, T) : M(g, a, v, y, W, T)
        }
        class _ extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            static tokenizer_class = b.AutoTokenizer;
            static uses_processor_config = !0;
            fake_image_token = "<fake_token_around_image>";
            image_token = "<image>";
            global_img_token = "<global-img>";
            async _call(v, g=null, y={}) {
                y.return_row_col_info ??= !0;
                let W;
                g && (W = await this.image_processor(g, y)),
                Array.isArray(v) || (v = [v]);
                let T = W.rows ?? [new Array(v.length).fill(0)]
                  , k = W.cols ?? [new Array(v.length).fill(0)]
                  , I = this.config.image_seq_len
                  , p = []
                  , m = [];
                for (let o = 0; o < v.length; ++o) {
                    let d = v[o]
                      , x = T[o]
                      , S = k[o];
                    p.push((0,
                    C.count)(d, this.image_token));
                    let N = x.map( ($, U) => L($, S[U], I, this.fake_image_token, this.image_token, this.global_img_token))
                      , j = d.split(this.image_token);
                    if (j.length === 0)
                        throw new Error("The image token should be present in the text.");
                    let D = j[0];
                    for (let $ = 0; $ < N.length; ++$)
                        D += N[$] + j[$ + 1];
                    m.push(D)
                }
                return {
                    ...this.tokenizer(m),
                    ...W
                }
            }
        }
    }
    ),
    "./src/models/image_processors.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            BeitFeatureExtractor: () => l.BeitFeatureExtractor,
            BitImageProcessor: () => h.BitImageProcessor,
            CLIPFeatureExtractor: () => R.CLIPFeatureExtractor,
            CLIPImageProcessor: () => R.CLIPImageProcessor,
            ChineseCLIPFeatureExtractor: () => b.ChineseCLIPFeatureExtractor,
            ConvNextFeatureExtractor: () => C.ConvNextFeatureExtractor,
            ConvNextImageProcessor: () => C.ConvNextImageProcessor,
            DINOv3ViTImageProcessor: () => L.DINOv3ViTImageProcessor,
            DPTFeatureExtractor: () => a.DPTFeatureExtractor,
            DPTImageProcessor: () => a.DPTImageProcessor,
            DeiTFeatureExtractor: () => M.DeiTFeatureExtractor,
            DeiTImageProcessor: () => M.DeiTImageProcessor,
            DetrFeatureExtractor: () => f.DetrFeatureExtractor,
            DetrImageProcessor: () => f.DetrImageProcessor,
            DonutFeatureExtractor: () => _.DonutFeatureExtractor,
            DonutImageProcessor: () => _.DonutImageProcessor,
            EfficientNetImageProcessor: () => v.EfficientNetImageProcessor,
            GLPNFeatureExtractor: () => g.GLPNFeatureExtractor,
            GroundingDinoImageProcessor: () => y.GroundingDinoImageProcessor,
            Idefics3ImageProcessor: () => W.Idefics3ImageProcessor,
            JinaCLIPImageProcessor: () => k.JinaCLIPImageProcessor,
            LlavaOnevisionImageProcessor: () => I.LlavaOnevisionImageProcessor,
            Mask2FormerImageProcessor: () => p.Mask2FormerImageProcessor,
            MaskFormerFeatureExtractor: () => m.MaskFormerFeatureExtractor,
            MaskFormerImageProcessor: () => m.MaskFormerImageProcessor,
            MobileNetV1FeatureExtractor: () => E.MobileNetV1FeatureExtractor,
            MobileNetV1ImageProcessor: () => E.MobileNetV1ImageProcessor,
            MobileNetV2FeatureExtractor: () => o.MobileNetV2FeatureExtractor,
            MobileNetV2ImageProcessor: () => o.MobileNetV2ImageProcessor,
            MobileNetV3FeatureExtractor: () => d.MobileNetV3FeatureExtractor,
            MobileNetV3ImageProcessor: () => d.MobileNetV3ImageProcessor,
            MobileNetV4FeatureExtractor: () => x.MobileNetV4FeatureExtractor,
            MobileNetV4ImageProcessor: () => x.MobileNetV4ImageProcessor,
            MobileViTFeatureExtractor: () => S.MobileViTFeatureExtractor,
            MobileViTImageProcessor: () => S.MobileViTImageProcessor,
            NougatImageProcessor: () => N.NougatImageProcessor,
            OwlViTFeatureExtractor: () => D.OwlViTFeatureExtractor,
            OwlViTImageProcessor: () => D.OwlViTImageProcessor,
            Owlv2ImageProcessor: () => j.Owlv2ImageProcessor,
            Phi3VImageProcessor: () => $.Phi3VImageProcessor,
            PvtImageProcessor: () => U.PvtImageProcessor,
            Qwen2VLImageProcessor: () => H.Qwen2VLImageProcessor,
            RTDetrImageProcessor: () => Z.RTDetrImageProcessor,
            Sam2ImageProcessor: () => le.Sam2ImageProcessor,
            Sam3ImageProcessor: () => we.Sam3ImageProcessor,
            SamImageProcessor: () => ee.SamImageProcessor,
            SegformerFeatureExtractor: () => ce.SegformerFeatureExtractor,
            SegformerImageProcessor: () => ce.SegformerImageProcessor,
            SiglipImageProcessor: () => Q.SiglipImageProcessor,
            SmolVLMImageProcessor: () => A.SmolVLMImageProcessor,
            Swin2SRImageProcessor: () => V.Swin2SRImageProcessor,
            VLMImageProcessor: () => T.VLMImageProcessor,
            ViTFeatureExtractor: () => J.ViTFeatureExtractor,
            ViTImageProcessor: () => J.ViTImageProcessor,
            VitMatteImageProcessor: () => ae.VitMatteImageProcessor,
            VitPoseImageProcessor: () => xe.VitPoseImageProcessor,
            YolosFeatureExtractor: () => be.YolosFeatureExtractor,
            YolosImageProcessor: () => be.YolosImageProcessor
        });
        var l = e("./src/models/beit/image_processing_beit.js")
          , h = e("./src/models/bit/image_processing_bit.js")
          , b = e("./src/models/chinese_clip/image_processing_chinese_clip.js")
          , R = e("./src/models/clip/image_processing_clip.js")
          , C = e("./src/models/convnext/image_processing_convnext.js")
          , M = e("./src/models/deit/image_processing_deit.js")
          , f = e("./src/models/detr/image_processing_detr.js")
          , L = e("./src/models/dinov3_vit/image_processing_dinov3_vit.js")
          , _ = e("./src/models/donut/image_processing_donut.js")
          , a = e("./src/models/dpt/image_processing_dpt.js")
          , v = e("./src/models/efficientnet/image_processing_efficientnet.js")
          , g = e("./src/models/glpn/image_processing_glpn.js")
          , y = e("./src/models/grounding_dino/image_processing_grounding_dino.js")
          , W = e("./src/models/idefics3/image_processing_idefics3.js")
          , T = e("./src/models/janus/image_processing_janus.js")
          , k = e("./src/models/jina_clip/image_processing_jina_clip.js")
          , I = e("./src/models/llava_onevision/image_processing_llava_onevision.js")
          , p = e("./src/models/mask2former/image_processing_mask2former.js")
          , m = e("./src/models/maskformer/image_processing_maskformer.js")
          , E = e("./src/models/mobilenet_v1/image_processing_mobilenet_v1.js")
          , o = e("./src/models/mobilenet_v2/image_processing_mobilenet_v2.js")
          , d = e("./src/models/mobilenet_v3/image_processing_mobilenet_v3.js")
          , x = e("./src/models/mobilenet_v4/image_processing_mobilenet_v4.js")
          , S = e("./src/models/mobilevit/image_processing_mobilevit.js")
          , N = e("./src/models/nougat/image_processing_nougat.js")
          , j = e("./src/models/owlv2/image_processing_owlv2.js")
          , D = e("./src/models/owlvit/image_processing_owlvit.js")
          , $ = e("./src/models/phi3_v/image_processing_phi3_v.js")
          , U = e("./src/models/pvt/image_processing_pvt.js")
          , H = e("./src/models/qwen2_vl/image_processing_qwen2_vl.js")
          , Z = e("./src/models/rt_detr/image_processing_rt_detr.js")
          , ee = e("./src/models/sam/image_processing_sam.js")
          , le = e("./src/models/sam2/image_processing_sam2.js")
          , we = e("./src/models/sam3/image_processing_sam3.js")
          , ce = e("./src/models/segformer/image_processing_segformer.js")
          , Q = e("./src/models/siglip/image_processing_siglip.js")
          , A = e("./src/models/smolvlm/image_processing_smolvlm.js")
          , V = e("./src/models/swin2sr/image_processing_swin2sr.js")
          , J = e("./src/models/vit/image_processing_vit.js")
          , ae = e("./src/models/vitmatte/image_processing_vitmatte.js")
          , xe = e("./src/models/vitpose/image_processing_vitpose.js")
          , be = e("./src/models/yolos/image_processing_yolos.js")
    }
    ),
    "./src/models/janus/image_processing_janus.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            VLMImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            constructor(R) {
                super({
                    do_pad: !0,
                    pad_size: {
                        width: R.image_size,
                        height: R.image_size
                    },
                    ...R
                }),
                this.constant_values = this.config.background_color.map(C => C * this.rescale_factor)
            }
            pad_image(R, C, M, f) {
                return super.pad_image(R, C, M, {
                    constant_values: this.constant_values,
                    center: !0,
                    ...f
                })
            }
        }
    }
    ),
    "./src/models/janus/processing_janus.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            VLChatProcessor: () => f
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/utils/core.js")
          , C = e("./src/utils/tensor.js")
          , M = e("./src/utils/image.js");
        class f extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            static tokenizer_class = b.AutoTokenizer;
            static uses_processor_config = !0;
            constructor(_, a, v) {
                super(_, a, v),
                this.image_tag = this.config.image_tag,
                this.image_start_tag = this.config.image_start_tag,
                this.image_end_tag = this.config.image_end_tag,
                this.num_image_tokens = this.config.num_image_tokens
            }
            async _call(_, {images: a=null, chat_template: v="default"}={}) {
                a ? Array.isArray(a) || (a = [a]) : a = await Promise.all(_.filter(S => S.images).flatMap(S => S.images).map(S => M.RawImage.read(S)));
                let g = this.tokenizer
                  , y = g.apply_chat_template(_, {
                    tokenize: !1,
                    add_generation_prompt: !0,
                    chat_template: v
                })
                  , W = S => g.encode(S, {
                    add_special_tokens: !1
                })
                  , T = y.split(this.image_tag)
                  , k = T.length - 1;
                if (a.length !== k)
                    throw new Error(`Number of images provided (${a.length}) does not match number of "${this.image_tag}" image tags (${k})`);
                let[I,p,m] = g.model.convert_tokens_to_ids([this.image_tag, this.image_start_tag, this.image_end_tag])
                  , E = W(T[0])
                  , o = new Array(E.length).fill(!1);
                for (let S = 1; S < T.length; ++S) {
                    let N = new Array(this.num_image_tokens).fill(I)
                      , j = W(T[S]);
                    E = (0,
                    R.mergeArrays)(E, [p], N, [m], j);
                    let D = new Array(this.num_image_tokens).fill(!0);
                    o = (0,
                    R.mergeArrays)(o, [!1], D, [!1], new Array(j.length).fill(!1))
                }
                let d = [1, E.length]
                  , x = {
                    input_ids: new C.Tensor("int64",E,d),
                    attention_mask: new C.Tensor("int64",new Array(E.length).fill(1),d),
                    images_seq_mask: new C.Tensor("bool",o,d),
                    images_emb_mask: new C.Tensor("bool",new Array(k * this.num_image_tokens).fill(!0),[1, k, this.num_image_tokens])
                };
                if (a && a.length > 0) {
                    let S = await this.image_processor(a);
                    return S.pixel_values.unsqueeze_(0),
                    {
                        ...x,
                        ...S
                    }
                }
                return x
            }
        }
    }
    ),
    "./src/models/jina_clip/image_processing_jina_clip.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            JinaCLIPImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            constructor(R) {
                let {resize_mode: C, fill_color: M, interpolation: f, size: L, ..._} = R
                  , a = C === "squash" ? {
                    width: L,
                    height: L
                } : C === "shortest" ? {
                    shortest_edge: L
                } : {
                    longest_edge: L
                }
                  , v = f === "bicubic" ? 3 : 2;
                super({
                    ..._,
                    size: a,
                    resample: v,
                    do_center_crop: !0,
                    crop_size: L,
                    do_normalize: !0
                })
            }
        }
    }
    ),
    "./src/models/jina_clip/processing_jina_clip.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            JinaCLIPProcessor: () => R
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js");
        class R extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            async _call(M=null, f=null, L={}) {
                if (!M && !f)
                    throw new Error("Either text or images must be provided");
                let _ = M ? this.tokenizer(M, L) : {}
                  , a = f ? await this.image_processor(f, L) : {};
                return {
                    ..._,
                    ...a
                }
            }
        }
    }
    ),
    "./src/models/llava/processing_llava.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            LlavaProcessor: () => R
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js");
        class R extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            static uses_processor_config = !0;
            async _call(M, f=null, L={}) {
                let _ = await this.image_processor(M, L);
                if (f) {
                    let[v,g] = _.pixel_values.dims.slice(-2)
                      , {image_token: y, patch_size: W, num_additional_image_tokens: T} = this.config
                      , k = Math.floor(v / W) * Math.floor(g / W) + T;
                    f = structuredClone(f),
                    Array.isArray(f) || (f = [f]);
                    for (let I = 0; I < f.length; ++I)
                        f[I] = f[I].replace(y, y.repeat(k))
                }
                let a = f ? this.tokenizer(f, L) : {};
                return {
                    ..._,
                    ...a
                }
            }
        }
    }
    ),
    "./src/models/llava_onevision/image_processing_llava_onevision.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            LlavaOnevisionImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/mask2former/image_processing_mask2former.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Mask2FormerImageProcessor: () => h
        });
        var l = e("./src/models/maskformer/image_processing_maskformer.js");
        class h extends l.MaskFormerImageProcessor {
        }
    }
    ),
    "./src/models/maskformer/image_processing_maskformer.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MaskFormerFeatureExtractor: () => b,
            MaskFormerImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_panoptic_segmentation(...C) {
                return (0,
                l.post_process_panoptic_segmentation)(...C)
            }
            post_process_instance_segmentation(...C) {
                return (0,
                l.post_process_instance_segmentation)(...C)
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/models/mgp_str/processing_mgp_str.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MgpstrProcessor: () => M
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/utils/maths.js");
        let C = {
            char: ["char_decode", 1],
            bpe: ["bpe_decode", 2],
            wp: ["wp_decode", 102]
        };
        class M extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            get char_tokenizer() {
                return this.components.char_tokenizer
            }
            get bpe_tokenizer() {
                return this.components.bpe_tokenizer
            }
            get wp_tokenizer() {
                return this.components.wp_tokenizer
            }
            _decode_helper(L, _) {
                if (!C.hasOwnProperty(_))
                    throw new Error(`Format ${_} is not supported.`);
                let[a,v] = C[_]
                  , g = this[a].bind(this)
                  , [y,W] = L.dims
                  , T = []
                  , k = []
                  , I = L.tolist();
                for (let m = 0; m < y; ++m) {
                    let E = I[m]
                      , o = []
                      , d = [];
                    for (let S = 1; S < W; ++S) {
                        let[N,j] = (0,
                        R.max)((0,
                        R.softmax)(E[S]));
                        if (d.push(N),
                        j == v)
                            break;
                        o.push(j)
                    }
                    let x = d.length > 0 ? d.reduce( (S, N) => S * N, 1) : 0;
                    k.push(o),
                    T.push(x)
                }
                return [g(k), T]
            }
            char_decode(L) {
                return this.char_tokenizer.batch_decode(L).map(_ => _.replaceAll(" ", ""))
            }
            bpe_decode(L) {
                return this.bpe_tokenizer.batch_decode(L)
            }
            wp_decode(L) {
                return this.wp_tokenizer.batch_decode(L).map(_ => _.replaceAll(" ", ""))
            }
            batch_decode([L,_,a]) {
                let[v,g] = this._decode_helper(L, "char")
                  , [y,W] = this._decode_helper(_, "bpe")
                  , [T,k] = this._decode_helper(a, "wp")
                  , I = []
                  , p = [];
                for (let m = 0; m < v.length; ++m) {
                    let[E,o] = (0,
                    R.max)([g[m], W[m], k[m]]);
                    I.push([v[m], y[m], T[m]][o]),
                    p.push(E)
                }
                return {
                    generated_text: I,
                    scores: p,
                    char_preds: v,
                    bpe_preds: y,
                    wp_preds: T
                }
            }
            static async from_pretrained(...L) {
                let _ = await super.from_pretrained(...L)
                  , a = await b.AutoTokenizer.from_pretrained("Xenova/gpt2")
                  , v = await b.AutoTokenizer.from_pretrained("Xenova/bert-base-uncased");
                return _.components = {
                    image_processor: _.image_processor,
                    char_tokenizer: _.tokenizer,
                    bpe_tokenizer: a,
                    wp_tokenizer: v
                },
                _
            }
            async _call(L, _=null) {
                let a = await this.image_processor(L);
                return _ && (a.labels = this.tokenizer(_).input_ids),
                a
            }
        }
    }
    ),
    "./src/models/mobilenet_v1/image_processing_mobilenet_v1.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MobileNetV1FeatureExtractor: () => b,
            MobileNetV1ImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/mobilenet_v2/image_processing_mobilenet_v2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MobileNetV2FeatureExtractor: () => b,
            MobileNetV2ImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/mobilenet_v3/image_processing_mobilenet_v3.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MobileNetV3FeatureExtractor: () => b,
            MobileNetV3ImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/mobilenet_v4/image_processing_mobilenet_v4.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MobileNetV4FeatureExtractor: () => b,
            MobileNetV4ImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/mobilevit/image_processing_mobilevit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MobileViTFeatureExtractor: () => b,
            MobileViTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/moonshine/feature_extraction_moonshine.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MoonshineFeatureExtractor: () => b
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.FeatureExtractor {
            async _call(C) {
                (0,
                l.validate_audio_inputs)(C, "MoonshineFeatureExtractor"),
                C instanceof Float64Array && (C = new Float32Array(C));
                let M = [1, C.length];
                return {
                    input_values: new h.Tensor("float32",C,M)
                }
            }
        }
    }
    ),
    "./src/models/moonshine/processing_moonshine.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MoonshineProcessor: () => R
        });
        var l = e("./src/models/auto/feature_extraction_auto.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/base/processing_utils.js");
        class R extends b.Processor {
            static tokenizer_class = h.AutoTokenizer;
            static feature_extractor_class = l.AutoFeatureExtractor;
            async _call(M) {
                return await this.feature_extractor(M)
            }
        }
    }
    ),
    "./src/models/nougat/image_processing_nougat.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            NougatImageProcessor: () => h
        });
        var l = e("./src/models/donut/image_processing_donut.js");
        class h extends l.DonutImageProcessor {
        }
    }
    ),
    "./src/models/owlv2/image_processing_owlv2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Owlv2ImageProcessor: () => h
        });
        var l = e("./src/models/owlvit/image_processing_owlvit.js");
        class h extends l.OwlViTImageProcessor {
        }
    }
    ),
    "./src/models/owlvit/image_processing_owlvit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            OwlViTFeatureExtractor: () => b,
            OwlViTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_object_detection(...C) {
                return (0,
                l.post_process_object_detection)(...C)
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/models/owlvit/processing_owlvit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            OwlViTProcessor: () => R
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js");
        class R extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor
        }
    }
    ),
    "./src/models/paligemma/processing_paligemma.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            PaliGemmaProcessor: () => M
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js");
        let R = "<image>";
        function C(f, L, _, a, v) {
            return `${a.repeat(_ * v)}${L}${f}
`
        }
        class M extends l.Processor {
            static tokenizer_class = b.AutoTokenizer;
            static image_processor_class = h.AutoImageProcessor;
            static uses_processor_config = !1;
            async _call(L, _=null, a={}) {
                _ || (console.warn("You are using PaliGemma without a text prefix. It will perform as a picture-captioning model."),
                _ = ""),
                Array.isArray(L) || (L = [L]),
                Array.isArray(_) || (_ = [_]);
                let v = this.tokenizer.bos_token, g = this.image_processor.config.image_seq_length, y;
                _.some(k => k.includes(R)) ? y = _.map(k => {
                    let I = k.replaceAll(R, R.repeat(g))
                      , p = I.lastIndexOf(R)
                      , m = p === -1 ? 0 : p + R.length;
                    return I.slice(0, m) + v + I.slice(m) + `
`
                }
                ) : (console.warn("You are passing both `text` and `images` to `PaliGemmaProcessor`. The processor expects special image tokens in the text, as many tokens as there are images per each text. It is recommended to add `<image>` tokens in the very beginning of your text. For this call, we will infer how many images each text has and add special tokens."),
                y = _.map(k => C(k, v, g, R, L.length)));
                let W = this.tokenizer(y, a);
                return {
                    ...await this.image_processor(L, a),
                    ...W
                }
            }
        }
    }
    ),
    "./src/models/parakeet/feature_extraction_parakeet.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ParakeetFeatureExtractor: () => C
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        let R = 1e-5;
        class C extends l.FeatureExtractor {
            constructor(f) {
                super(f),
                this.config.mel_filters ??= (0,
                b.mel_filter_bank)(Math.floor(1 + this.config.n_fft / 2), this.config.feature_size, 0, this.config.sampling_rate / 2, this.config.sampling_rate, "slaney", "slaney");
                let L = (0,
                b.window_function)(this.config.win_length, "hann", {
                    periodic: !1
                });
                this.window = new Float64Array(this.config.n_fft);
                let _ = Math.floor((this.config.n_fft - this.config.win_length) / 2);
                this.window.set(L, _)
            }
            async _extract_fbank_features(f) {
                let L = this.config.preemphasis;
                f = new Float64Array(f);
                for (let a = f.length - 1; a >= 1; --a)
                    f[a] -= L * f[a - 1];
                return await (0,
                b.spectrogram)(f, this.window, this.window.length, this.config.hop_length, {
                    fft_length: this.config.n_fft,
                    power: 2,
                    mel_filters: this.config.mel_filters,
                    log_mel: "log",
                    mel_floor: -1 / 0,
                    pad_mode: "constant",
                    center: !0,
                    transpose: !0,
                    mel_offset: 2 ** -24
                })
            }
            async _call(f) {
                (0,
                l.validate_audio_inputs)(f, "ParakeetFeatureExtractor");
                let L = await this._extract_fbank_features(f)
                  , _ = Math.floor((f.length + Math.floor(this.config.n_fft / 2) * 2 - this.config.n_fft) / this.config.hop_length)
                  , a = L.data;
                a.fill(0, _ * L.dims[1]);
                let[v,g] = L.dims
                  , y = new Float64Array(g)
                  , W = new Float64Array(g);
                for (let I = 0; I < _; ++I) {
                    let p = I * g;
                    for (let m = 0; m < g; ++m) {
                        let E = a[p + m];
                        y[m] += E,
                        W[m] += E * E
                    }
                }
                let T = _ > 1 ? _ - 1 : 1;
                for (let I = 0; I < g; ++I) {
                    let p = y[I] / _
                      , m = (W[I] - _ * p * p) / T
                      , o = 1 / (Math.sqrt(m) + R);
                    for (let d = 0; d < _; ++d) {
                        let x = d * g + I;
                        a[x] = (a[x] - p) * o
                    }
                }
                let k = new BigInt64Array(v);
                return k.fill(1n, 0, _),
                {
                    input_features: L.unsqueeze_(0),
                    attention_mask: new h.Tensor("int64",k,[1, v])
                }
            }
        }
    }
    ),
    "./src/models/phi3_v/image_processing_phi3_v.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Phi3VImageProcessor: () => L
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        let b = 336
          , R = [2, 3]
          , {ceil: C, floor: M, sqrt: f} = Math;
        class L extends l.ImageProcessor {
            constructor(a) {
                super({
                    ...a,
                    do_normalize: !0,
                    do_pad: !0,
                    pad_size: "custom",
                    do_convert_rgb: !0,
                    do_resize: !0
                }),
                this._num_crops = a.num_crops
            }
            calc_num_image_tokens_from_image_size(a, v) {
                let {num_img_tokens: g} = this.config;
                return M((M(v / b) * M(a / b) + 1) * g + 1 + (M(v / b) + 1) * f(g))
            }
            get_resize_output_image_size(a, v) {
                let g = this._num_crops
                  , [y,W] = a.size
                  , T = y / W
                  , k = 1;
                for (; k * Math.ceil(k / T) <= g; )
                    k += 1;
                k -= 1;
                let I = Math.floor(k * 336)
                  , p = Math.floor(I / T);
                return [I, p]
            }
            pad_image(a, v, g, y={}) {
                let[W,T] = v
                  , k = b * C(W / b)
                  , I = b * C(T / b)
                  , p = [1, 1, 1].map( (m, E) => (m - this.image_mean[E]) / this.image_std[E]);
                return super.pad_image(a, v, {
                    width: I,
                    height: k
                }, {
                    center: !0,
                    constant_values: p,
                    ...y
                })
            }
            async _call(a, {num_crops: v=null}={}) {
                if (this._num_crops = v ??= this.config.num_crops,
                v < 4 || f(v) % 1 !== 0)
                    throw new Error("num_crops must be a square number >= 4");
                Array.isArray(a) || (a = [a]);
                let g = a.length
                  , y = await Promise.all(a.map(o => this.preprocess(o)))
                  , W = y.map(o => o.original_size)
                  , T = y.map(o => o.reshaped_input_size)
                  , k = [];
                for (let {pixel_values: o} of y) {
                    o.unsqueeze_(0);
                    let[d,x] = o.dims.slice(-2)
                      , S = await (0,
                    h.interpolate_4d)(o, {
                        size: [b, b],
                        mode: "bicubic"
                    });
                    if (v > 0) {
                        let N = []
                          , j = f(v)
                          , D = M(x / j)
                          , $ = M(d / j);
                        for (let H = 0; H < j; ++H)
                            for (let Z = 0; Z < j; ++Z) {
                                let ee, le, we, ce;
                                H === j - 1 ? (le = d - $,
                                ce = d) : (le = H * $,
                                ce = (H + 1) * $),
                                Z === j - 1 ? (ee = x - D,
                                we = x) : (ee = Z * D,
                                we = (Z + 1) * D);
                                let Q = [le, ee]
                                  , A = [ce, we]
                                  , V = await (0,
                                h.slice)(o, Q, A, R);
                                N.push(V)
                            }
                        let U = await (0,
                        h.interpolate_4d)((0,
                        h.cat)(N, 0), {
                            size: [b, b],
                            mode: "bicubic"
                        });
                        k.push((0,
                        h.cat)([S, U], 0))
                    } else
                        k.push(S)
                }
                let I = (0,
                h.stack)(k, 0)
                  , p = T.map(o => o.map(d => b * C(d / b)))
                  , m = new h.Tensor("int64",p.flat(),[g, 2])
                  , E = p.map( ([o,d]) => this.calc_num_image_tokens_from_image_size(d, o));
                return {
                    pixel_values: I,
                    original_sizes: W,
                    reshaped_input_sizes: T,
                    image_sizes: m,
                    num_img_tokens: E
                }
            }
        }
    }
    ),
    "./src/models/phi3_v/processing_phi3_v.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Phi3VProcessor: () => f
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/utils/image.js");
        let C = "<|image|>"
          , M = /<\|image_\d+\|>/g;
        class f extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            static tokenizer_class = b.AutoTokenizer;
            async _call(_, a=null, {padding: v=!0, truncation: g=!0, num_crops: y=null}={}) {
                Array.isArray(_) || (_ = [_]);
                let W, T;
                if (a) {
                    T = await this.image_processor(a, {
                        num_crops: y
                    });
                    let {num_img_tokens: k} = T
                      , I = _.map( (m, E) => m.split(M).join(C.repeat(k[E])));
                    W = this.tokenizer(I, {
                        padding: v,
                        truncation: g
                    });
                    let p = this.tokenizer.model.convert_tokens_to_ids([C])[0];
                    W.input_ids.map_(m => m == p ? -m : m)
                } else
                    W = this.tokenizer(_);
                return {
                    ...W,
                    ...T
                }
            }
        }
    }
    ),
    "./src/models/processors.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Florence2Processor: () => l.Florence2Processor,
            Gemma3nProcessor: () => h.Gemma3nProcessor,
            GroundingDinoProcessor: () => b.GroundingDinoProcessor,
            Idefics3Processor: () => R.Idefics3Processor,
            JinaCLIPProcessor: () => M.JinaCLIPProcessor,
            LlavaProcessor: () => f.LlavaProcessor,
            MgpstrProcessor: () => L.MgpstrProcessor,
            MoonshineProcessor: () => _.MoonshineProcessor,
            OwlViTProcessor: () => a.OwlViTProcessor,
            PaliGemmaProcessor: () => g.PaliGemmaProcessor,
            Phi3VProcessor: () => v.Phi3VProcessor,
            PyAnnoteProcessor: () => y.PyAnnoteProcessor,
            Qwen2VLProcessor: () => W.Qwen2VLProcessor,
            Sam2Processor: () => k.Sam2Processor,
            Sam2VideoProcessor: () => k.Sam2VideoProcessor,
            SamProcessor: () => T.SamProcessor,
            SmolVLMProcessor: () => I.SmolVLMProcessor,
            SpeechT5Processor: () => p.SpeechT5Processor,
            UltravoxProcessor: () => m.UltravoxProcessor,
            VLChatProcessor: () => C.VLChatProcessor,
            VoxtralProcessor: () => E.VoxtralProcessor,
            Wav2Vec2Processor: () => o.Wav2Vec2Processor,
            Wav2Vec2ProcessorWithLM: () => d.Wav2Vec2ProcessorWithLM,
            WhisperProcessor: () => x.WhisperProcessor
        });
        var l = e("./src/models/florence2/processing_florence2.js")
          , h = e("./src/models/gemma3n/processing_gemma3n.js")
          , b = e("./src/models/grounding_dino/processing_grounding_dino.js")
          , R = e("./src/models/idefics3/processing_idefics3.js")
          , C = e("./src/models/janus/processing_janus.js")
          , M = e("./src/models/jina_clip/processing_jina_clip.js")
          , f = e("./src/models/llava/processing_llava.js")
          , L = e("./src/models/mgp_str/processing_mgp_str.js")
          , _ = e("./src/models/moonshine/processing_moonshine.js")
          , a = e("./src/models/owlvit/processing_owlvit.js")
          , v = e("./src/models/phi3_v/processing_phi3_v.js")
          , g = e("./src/models/paligemma/processing_paligemma.js")
          , y = e("./src/models/pyannote/processing_pyannote.js")
          , W = e("./src/models/qwen2_vl/processing_qwen2_vl.js")
          , T = e("./src/models/sam/processing_sam.js")
          , k = e("./src/models/sam2/processing_sam2.js")
          , I = e("./src/models/smolvlm/processing_smolvlm.js")
          , p = e("./src/models/speecht5/processing_speecht5.js")
          , m = e("./src/models/ultravox/processing_ultravox.js")
          , E = e("./src/models/voxtral/processing_voxtral.js")
          , o = e("./src/models/wav2vec2/processing_wav2vec2.js")
          , d = e("./src/models/wav2vec2_with_lm/processing_wav2vec2_with_lm.js")
          , x = e("./src/models/whisper/processing_whisper.js")
    }
    ),
    "./src/models/pvt/image_processing_pvt.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            PvtImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/pyannote/feature_extraction_pyannote.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            PyAnnoteFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/maths.js");
        class R extends l.FeatureExtractor {
            async _call(M) {
                (0,
                l.validate_audio_inputs)(M, "PyAnnoteFeatureExtractor"),
                M instanceof Float64Array && (M = new Float32Array(M));
                let f = [1, 1, M.length];
                return {
                    input_values: new h.Tensor("float32",M,f)
                }
            }
            samples_to_frames(M) {
                return (M - this.config.offset) / this.config.step
            }
            post_process_speaker_diarization(M, f) {
                let L = f / this.samples_to_frames(f) / this.config.sampling_rate
                  , _ = [];
                for (let a of M.tolist()) {
                    let v = []
                      , g = -1;
                    for (let y = 0; y < a.length; ++y) {
                        let W = (0,
                        b.softmax)(a[y])
                          , [T,k] = (0,
                        b.max)(W)
                          , [I,p] = [y, y + 1];
                        k !== g ? (g = k,
                        v.push({
                            id: k,
                            start: I,
                            end: p,
                            score: T
                        })) : (v.at(-1).end = p,
                        v.at(-1).score += T)
                    }
                    _.push(v.map( ({id: y, start: W, end: T, score: k}) => ({
                        id: y,
                        start: W * L,
                        end: T * L,
                        confidence: k / (T - W)
                    })))
                }
                return _
            }
        }
    }
    ),
    "./src/models/pyannote/processing_pyannote.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            PyAnnoteProcessor: () => b
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/pyannote/feature_extraction_pyannote.js");
        class b extends l.Processor {
            static feature_extractor_class = h.PyAnnoteFeatureExtractor;
            async _call(C) {
                return await this.feature_extractor(C)
            }
            post_process_speaker_diarization(...C) {
                return this.feature_extractor.post_process_speaker_diarization(...C)
            }
            get sampling_rate() {
                return this.feature_extractor.config.sampling_rate
            }
        }
    }
    ),
    "./src/models/qwen2_vl/image_processing_qwen2_vl.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Qwen2VLImageProcessor: () => b
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.ImageProcessor {
            async _call(C, ...M) {
                let {pixel_values: f, original_sizes: L, reshaped_input_sizes: _} = await super._call(C, ...M)
                  , a = f
                  , {temporal_patch_size: v, merge_size: g, patch_size: y} = this.config;
                a.dims[0] === 1 && (a = (0,
                h.cat)(Array.from({
                    length: v
                }, () => a), 0));
                let W = a.dims[0] / v
                  , T = a.dims[1]
                  , k = Math.floor(a.dims[2] / y)
                  , I = Math.floor(a.dims[3] / y)
                  , p = a.view(W, v, T, Math.floor(k / g), g, y, Math.floor(I / g), g, y).permute(0, 3, 6, 4, 7, 2, 1, 5, 8).view(W * k * I, T * v * y * y)
                  , m = new h.Tensor("int64",[W, k, I],[1, 3]);
                return {
                    pixel_values: p,
                    image_grid_thw: m,
                    original_sizes: L,
                    reshaped_input_sizes: _
                }
            }
        }
    }
    ),
    "./src/models/qwen2_vl/processing_qwen2_vl.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Qwen2VLProcessor: () => C
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js")
          , b = e("./src/tokenizers.js")
          , R = e("./src/utils/image.js");
        class C extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            static tokenizer_class = b.AutoTokenizer;
            async _call(f, L=null, ..._) {
                Array.isArray(f) || (f = [f]);
                let a, v;
                if (L && (a = await this.image_processor(L),
                v = a.image_grid_thw),
                v) {
                    let y = this.image_processor.config.merge_size ** 2
                      , W = 0
                      , T = v.tolist();
                    f = f.map(k => {
                        for (; k.includes("<|image_pad|>"); ) {
                            let I = Number(T[W++].reduce( (p, m) => p * m, 1n));
                            k = k.replace("<|image_pad|>", "<|placeholder|>".repeat(Math.floor(I / y)))
                        }
                        return k.replaceAll("<|placeholder|>", "<|image_pad|>")
                    }
                    )
                }
                return {
                    ...this.tokenizer(f),
                    ...a
                }
            }
        }
    }
    ),
    "./src/models/rt_detr/image_processing_rt_detr.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            RTDetrImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_object_detection(...R) {
                return (0,
                l.post_process_object_detection)(...R)
            }
        }
    }
    ),
    "./src/models/sam/image_processing_sam.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SamImageProcessor: () => R
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/core.js")
          , b = e("./src/utils/tensor.js");
        class R extends l.ImageProcessor {
            reshape_input_points(M, f, L, _=!1) {
                M = structuredClone(M);
                let a = (0,
                h.calculateDimensions)(M);
                if (a.length === 3)
                    _ || (a = [1, ...a]),
                    M = [M];
                else if (a.length !== 4)
                    throw Error("The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.");
                for (let v = 0; v < M.length; ++v) {
                    let[g,y] = f[v]
                      , [W,T] = L[v]
                      , k = [T / y, W / g];
                    for (let I = 0; I < M[v].length; ++I)
                        for (let p = 0; p < M[v][I].length; ++p)
                            for (let m = 0; m < M[v][I][p].length; ++m)
                                M[v][I][p][m] *= k[m % 2]
                }
                return new b.Tensor("float32",Float32Array.from(M.flat(1 / 0)),a)
            }
            add_input_labels(M, f) {
                let L = (0,
                h.calculateDimensions)(M);
                if (L.length === 2)
                    L = [1, ...L],
                    M = [M];
                else if (L.length !== 3)
                    throw Error("The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.");
                if (L.some( (_, a) => _ !== f.dims[a]))
                    throw Error(`The first ${L.length} dimensions of 'input_points' and 'input_labels' must be the same.`);
                return new b.Tensor("int64",M.flat(1 / 0).map(BigInt),L)
            }
            async _call(M, {input_points: f=null, input_labels: L=null, input_boxes: _=null}={}) {
                let a = await super._call(M);
                if (f && (a.input_points = this.reshape_input_points(f, a.original_sizes, a.reshaped_input_sizes)),
                L) {
                    if (!a.input_points)
                        throw Error("`input_points` must be provided if `input_labels` are provided.");
                    a.input_labels = this.add_input_labels(L, a.input_points)
                }
                return _ && (a.input_boxes = this.reshape_input_points(_, a.original_sizes, a.reshaped_input_sizes, !0)),
                a
            }
            async post_process_masks(M, f, L, {mask_threshold: _=0, binarize: a=!0, pad_size: v=null}={}) {
                let g = [];
                v = v ?? this.pad_size ?? this.size;
                let y = [v.height, v.width];
                for (let W = 0; W < f.length; ++W) {
                    let T = f[W]
                      , k = L[W]
                      , I = await (0,
                    b.interpolate_4d)(M[W], {
                        mode: "bilinear",
                        size: y
                    });
                    if (I = I.slice(null, null, [0, k[0]], [0, k[1]]),
                    I = await (0,
                    b.interpolate_4d)(I, {
                        mode: "bilinear",
                        size: T
                    }),
                    a) {
                        let p = I.data
                          , m = new Uint8Array(p.length);
                        for (let E = 0; E < p.length; ++E)
                            p[E] > _ && (m[E] = 1);
                        I = new b.Tensor("bool",m,I.dims)
                    }
                    g.push(I)
                }
                return g
            }
            generate_crop_boxes(M, f, {crop_n_layers: L=0, overlap_ratio: _=512 / 1500, points_per_crop: a=32, crop_n_points_downscale_factor: v=1}={}) {}
        }
    }
    ),
    "./src/models/sam/processing_sam.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SamProcessor: () => b
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/models/auto/image_processing_auto.js");
        class b extends l.Processor {
            static image_processor_class = h.AutoImageProcessor;
            async _call(...C) {
                return await this.image_processor(...C)
            }
            post_process_masks(...C) {
                return this.image_processor.post_process_masks(...C)
            }
            reshape_input_points(...C) {
                return this.image_processor.reshape_input_points(...C)
            }
        }
    }
    ),
    "./src/models/sam2/image_processing_sam2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Sam2ImageProcessor: () => l.SamImageProcessor
        });
        var l = e("./src/models/sam/image_processing_sam.js")
    }
    ),
    "./src/models/sam2/processing_sam2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Sam2Processor: () => h,
            Sam2VideoProcessor: () => b
        });
        var l = e("./src/models/sam/processing_sam.js");
        class h extends l.SamProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/sam3/image_processing_sam3.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Sam3ImageProcessor: () => l.Sam2ImageProcessor
        });
        var l = e("./src/models/sam2/image_processing_sam2.js")
    }
    ),
    "./src/models/seamless_m4t/feature_extraction_seamless_m4t.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SeamlessM4TFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        class R extends l.FeatureExtractor {
            constructor(M) {
                super(M);
                let f = this.config.sampling_rate
                  , L = (0,
                b.mel_filter_bank)(257, this.config.num_mel_bins, 20, Math.floor(f / 2), f, null, "kaldi", !0);
                this.mel_filters = L,
                this.window = (0,
                b.window_function)(400, "povey", {
                    periodic: !1
                })
            }
            async _extract_fbank_features(M, f) {
                return M = M.map(L => L * 32768),
                (0,
                b.spectrogram)(M, this.window, 400, 160, {
                    fft_length: 512,
                    power: 2,
                    center: !1,
                    preemphasis: .97,
                    mel_filters: this.mel_filters,
                    log_mel: "log",
                    mel_floor: 1192092955078125e-22,
                    remove_dc_offset: !0,
                    max_num_frames: f,
                    transpose: !0
                })
            }
            async _call(M, {padding: f=!0, pad_to_multiple_of: L=2, do_normalize_per_mel_bins: _=!0, return_attention_mask: a=!0}={}) {
                (0,
                l.validate_audio_inputs)(M, "SeamlessM4TFeatureExtractor");
                let v = await this._extract_fbank_features(M, this.config.max_length);
                if (_) {
                    let[m,E] = v.dims
                      , o = v.data;
                    for (let d = 0; d < E; ++d) {
                        let x = 0;
                        for (let D = 0; D < m; ++D)
                            x += o[D * E + d];
                        let S = x / m
                          , N = 0;
                        for (let D = 0; D < m; ++D)
                            N += (o[D * E + d] - S) ** 2;
                        N /= m - 1;
                        let j = Math.sqrt(N + 1e-7);
                        for (let D = 0; D < m; ++D) {
                            let $ = D * E + d;
                            o[$] = (o[$] - S) / j
                        }
                    }
                }
                let g;
                if (f) {
                    let[m,E] = v.dims
                      , o = v.data
                      , d = m % L;
                    if (d > 0) {
                        let x = new Float32Array(E * (m + d));
                        x.set(o),
                        x.fill(this.config.padding_value, o.length);
                        let S = m + d;
                        v = new h.Tensor(v.type,x,[S, E]),
                        a && (g = new h.Tensor("int64",new BigInt64Array(S),[1, S]),
                        g.data.fill(1n, 0, m))
                    }
                }
                let[y,W] = v.dims
                  , T = this.config.stride;
                if (y % T !== 0)
                    throw new Error(`The number of frames (${y}) must be a multiple of the stride (${T}).`);
                let I = v.view(1, Math.floor(y / T), W * T)
                  , p = {
                    input_features: I
                };
                if (a) {
                    let m = I.dims[1]
                      , E = new BigInt64Array(m);
                    if (g) {
                        let o = g.data;
                        for (let d = 1, x = 0; d < y; d += T,
                        ++x)
                            E[x] = o[d]
                    } else
                        E.fill(1n);
                    p.attention_mask = new h.Tensor("int64",E,[1, m])
                }
                return p
            }
        }
    }
    ),
    "./src/models/segformer/image_processing_segformer.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SegformerFeatureExtractor: () => b,
            SegformerImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_semantic_segmentation(...C) {
                return (0,
                l.post_process_semantic_segmentation)(...C)
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/models/siglip/image_processing_siglip.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SiglipImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
    }
    ),
    "./src/models/smolvlm/image_processing_smolvlm.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SmolVLMImageProcessor: () => l.Idefics3ImageProcessor
        });
        var l = e("./src/models/idefics3/image_processing_idefics3.js")
    }
    ),
    "./src/models/smolvlm/processing_smolvlm.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SmolVLMProcessor: () => l.Idefics3Processor
        });
        var l = e("./src/models/idefics3/processing_idefics3.js")
    }
    ),
    "./src/models/snac/feature_extraction_snac.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SnacFeatureExtractor: () => h
        });
        var l = e("./src/models/dac/feature_extraction_dac.js");
        class h extends l.DacFeatureExtractor {
        }
    }
    ),
    "./src/models/speecht5/feature_extraction_speecht5.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SpeechT5FeatureExtractor: () => h
        });
        var l = e("./src/base/feature_extraction_utils.js");
        class h extends l.FeatureExtractor {
        }
    }
    ),
    "./src/models/speecht5/processing_speecht5.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            SpeechT5Processor: () => R
        });
        var l = e("./src/base/processing_utils.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/models/auto/feature_extraction_auto.js");
        class R extends l.Processor {
            static tokenizer_class = h.AutoTokenizer;
            static feature_extractor_class = b.AutoFeatureExtractor;
            async _call(M) {
                return await this.feature_extractor(M)
            }
        }
    }
    ),
    "./src/models/swin2sr/image_processing_swin2sr.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Swin2SRImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            pad_image(R, C, M, f={}) {
                let[L,_,a] = C;
                return super.pad_image(R, C, {
                    width: _ + (M - _ % M) % M,
                    height: L + (M - L % M) % M
                }, {
                    mode: "symmetric",
                    center: !1,
                    constant_values: -1,
                    ...f
                })
            }
        }
    }
    ),
    "./src/models/ultravox/processing_ultravox.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            UltravoxProcessor: () => R
        });
        var l = e("./src/models/auto/feature_extraction_auto.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/base/processing_utils.js");
        class R extends b.Processor {
            static tokenizer_class = h.AutoTokenizer;
            static feature_extractor_class = l.AutoFeatureExtractor;
            static uses_processor_config = !0;
            async _call(M, f=null, L={}) {
                if (Array.isArray(M))
                    throw new Error("Batched inputs are not supported yet.");
                let _ = {};
                if (f) {
                    let v = f.length
                      , {input_features: g} = await this.feature_extractor(f, {
                        ...L,
                        max_length: v
                    })
                      , y = Math.round(v / this.config.encoder_ds_factor + 1e-4)
                      , W = 1 + Math.ceil(y / this.config.stack_factor);
                    _.audio_token_len = [W],
                    _.audio_values = g;
                    let T = this.config.audio_placeholder;
                    if (!M.includes(T))
                        throw new Error(`The input text does not contain the image token ${T}.`);
                    M = M.replaceAll(T, T.repeat(W))
                }
                return {
                    ...this.tokenizer(M, {
                        add_special_tokens: !1,
                        ...L
                    }),
                    ..._
                }
            }
        }
    }
    ),
    "./src/models/vit/image_processing_vit.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            ViTFeatureExtractor: () => b,
            ViTImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
        }
        class b extends h {
        }
    }
    ),
    "./src/models/vitmatte/image_processing_vitmatte.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            VitMatteImageProcessor: () => b
        });
        var l = e("./src/base/image_processors_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.ImageProcessor {
            async _call(C, M) {
                Array.isArray(C) || (C = [C]),
                Array.isArray(M) || (M = [M]);
                let f = await Promise.all(C.map(a => this.preprocess(a)))
                  , L = await Promise.all(M.map(a => this.preprocess(a, {
                    do_normalize: !1,
                    do_convert_rgb: !1,
                    do_convert_grayscale: !0
                })));
                return {
                    pixel_values: (0,
                    h.stack)(f.map( (a, v) => (0,
                    h.cat)([a.pixel_values, L[v].pixel_values], 0)), 0),
                    original_sizes: f.map(a => a.original_size),
                    reshaped_input_sizes: f.map(a => a.reshaped_input_size)
                }
            }
        }
    }
    ),
    "./src/models/vitpose/image_processing_vitpose.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            VitPoseImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_pose_estimation(R, C, {threshold: M=null}={}) {
                let f = R.tolist()
                  , [L,_,a,v] = R.dims
                  , g = [];
                for (let y = 0; y < L; ++y) {
                    let W = f[y]
                      , T = C[y]
                      , k = [];
                    for (let I = 0; I < T.length; ++I) {
                        let p = T[I]
                          , m = []
                          , E = []
                          , o = []
                          , d = p.at(-2) / v
                          , x = p.at(-1) / a;
                        for (let S = 0; S < W.length; ++S) {
                            let[N,j] = [0, 0]
                              , D = 0
                              , $ = -1 / 0
                              , U = W[S];
                            for (let Z = 0; Z < U.length; ++Z) {
                                let ee = U[Z];
                                for (let le = 0; le < ee.length; ++le) {
                                    let we = ee[le];
                                    D += we,
                                    $ = Math.max($, we),
                                    N += (le + .5) * we,
                                    j += Z * we
                                }
                            }
                            if (M != null && $ < M)
                                continue;
                            let H = [d * N / D, x * j / D];
                            m.push(H),
                            o.push(S),
                            E.push($)
                        }
                        k.push({
                            bbox: p,
                            scores: E,
                            labels: o,
                            keypoints: m
                        })
                    }
                    g.push(k)
                }
                return g
            }
        }
    }
    ),
    "./src/models/voxtral/processing_voxtral.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            VoxtralProcessor: () => _
        });
        var l = e("./src/models/auto/feature_extraction_auto.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/base/processing_utils.js")
          , R = e("./src/utils/tensor.js");
        let C = "[AUDIO]"
          , M = "[BEGIN_AUDIO]"
          , f = 375;
        function L(a, v) {
            let g = [];
            for (let y = 0; y < a.length; y += v)
                g.push(a.subarray(y, Math.min(y + v, a.length)));
            return g
        }
        class _ extends b.Processor {
            static tokenizer_class = h.AutoTokenizer;
            static feature_extractor_class = l.AutoFeatureExtractor;
            static uses_processor_config = !1;
            async _call(v, g=null, y={}) {
                if (Array.isArray(v))
                    throw new Error("Batched inputs are not supported yet.");
                let W = {};
                if (g) {
                    if (!v.includes(C))
                        throw new Error(`The input text does not contain the audio token ${C}.`);
                    Array.isArray(g) || (g = [g]);
                    let k = v.split(C)
                      , I = k.length - 1;
                    if (I !== g.length)
                        throw new Error(`The number of audio inputs (${g.length}) does not match the number of audio tokens in the text (${I}).`);
                    let p = this.feature_extractor.config.n_samples
                      , m = g.map(S => L(S, p))
                      , E = m.map(S => S.length)
                      , o = m.flat()
                      , d = (await Promise.all(o.map(S => this.feature_extractor(S, y)))).map(S => S.input_features);
                    W.audio_values = d.length > 1 ? (0,
                    R.cat)(d, 0) : d[0];
                    let x = k[0];
                    for (let S = 0; S < E.length; ++S) {
                        x += M;
                        for (let N = 0; N < E[S]; ++N)
                            x += C.repeat(f);
                        x += k[S + 1]
                    }
                    v = x
                }
                return {
                    ...this.tokenizer(v, {
                        add_special_tokens: !1,
                        ...y
                    }),
                    ...W
                }
            }
        }
    }
    ),
    "./src/models/wav2vec2/feature_extraction_wav2vec2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Wav2Vec2FeatureExtractor: () => b
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js");
        class b extends l.FeatureExtractor {
            _zero_mean_unit_var_norm(C) {
                let f = C.reduce( (_, a) => _ + a, 0) / C.length
                  , L = C.reduce( (_, a) => _ + (a - f) ** 2, 0) / C.length;
                return C.map(_ => (_ - f) / Math.sqrt(L + 1e-7))
            }
            async _call(C) {
                (0,
                l.validate_audio_inputs)(C, "Wav2Vec2FeatureExtractor"),
                C instanceof Float64Array && (C = new Float32Array(C));
                let M = C;
                this.config.do_normalize && (M = this._zero_mean_unit_var_norm(M));
                let f = [1, M.length];
                return {
                    input_values: new h.Tensor("float32",M,f),
                    attention_mask: new h.Tensor("int64",new BigInt64Array(M.length).fill(1n),f)
                }
            }
        }
    }
    ),
    "./src/models/wav2vec2/processing_wav2vec2.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Wav2Vec2Processor: () => R
        });
        var l = e("./src/tokenizers.js")
          , h = e("./src/models/auto/feature_extraction_auto.js")
          , b = e("./src/base/processing_utils.js");
        class R extends b.Processor {
            static tokenizer_class = l.AutoTokenizer;
            static feature_extractor_class = h.AutoFeatureExtractor;
            async _call(M) {
                return await this.feature_extractor(M)
            }
        }
    }
    ),
    "./src/models/wav2vec2_with_lm/processing_wav2vec2_with_lm.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Wav2Vec2ProcessorWithLM: () => R
        });
        var l = e("./src/tokenizers.js")
          , h = e("./src/models/auto/feature_extraction_auto.js")
          , b = e("./src/base/processing_utils.js");
        class R extends b.Processor {
            static tokenizer_class = l.AutoTokenizer;
            static feature_extractor_class = h.AutoFeatureExtractor;
            async _call(M) {
                return await this.feature_extractor(M)
            }
        }
    }
    ),
    "./src/models/wespeaker/feature_extraction_wespeaker.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            WeSpeakerFeatureExtractor: () => R
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js");
        class R extends l.FeatureExtractor {
            constructor(M) {
                super(M);
                let f = this.config.sampling_rate
                  , L = (0,
                b.mel_filter_bank)(257, this.config.num_mel_bins, 20, Math.floor(f / 2), f, null, "kaldi", !0);
                this.mel_filters = L,
                this.window = (0,
                b.window_function)(400, "hamming", {
                    periodic: !1
                }),
                this.min_num_frames = this.config.min_num_frames
            }
            async _extract_fbank_features(M) {
                return M = M.map(f => f * 32768),
                (0,
                b.spectrogram)(M, this.window, 400, 160, {
                    fft_length: 512,
                    power: 2,
                    center: !1,
                    preemphasis: .97,
                    mel_filters: this.mel_filters,
                    log_mel: "log",
                    mel_floor: 1192092955078125e-22,
                    remove_dc_offset: !0,
                    transpose: !0,
                    min_num_frames: this.min_num_frames
                })
            }
            async _call(M) {
                (0,
                l.validate_audio_inputs)(M, "WeSpeakerFeatureExtractor");
                let f = (await this._extract_fbank_features(M)).unsqueeze_(0);
                if (this.config.fbank_centering_span === null) {
                    let L = f.mean(1).data
                      , _ = f.data
                      , [a,v,g] = f.dims;
                    for (let y = 0; y < a; ++y) {
                        let W = y * v * g
                          , T = y * g;
                        for (let k = 0; k < v; ++k) {
                            let I = W + k * g;
                            for (let p = 0; p < g; ++p)
                                _[I + p] -= L[T + p]
                        }
                    }
                }
                return {
                    input_features: f
                }
            }
        }
    }
    ),
    "./src/models/whisper/common_whisper.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            WHISPER_LANGUAGE_MAPPING: () => h,
            WHISPER_TO_LANGUAGE_CODE_MAPPING: () => b,
            whisper_language_to_code: () => R
        });
        let l = [["en", "english"], ["zh", "chinese"], ["de", "german"], ["es", "spanish"], ["ru", "russian"], ["ko", "korean"], ["fr", "french"], ["ja", "japanese"], ["pt", "portuguese"], ["tr", "turkish"], ["pl", "polish"], ["ca", "catalan"], ["nl", "dutch"], ["ar", "arabic"], ["sv", "swedish"], ["it", "italian"], ["id", "indonesian"], ["hi", "hindi"], ["fi", "finnish"], ["vi", "vietnamese"], ["he", "hebrew"], ["uk", "ukrainian"], ["el", "greek"], ["ms", "malay"], ["cs", "czech"], ["ro", "romanian"], ["da", "danish"], ["hu", "hungarian"], ["ta", "tamil"], ["no", "norwegian"], ["th", "thai"], ["ur", "urdu"], ["hr", "croatian"], ["bg", "bulgarian"], ["lt", "lithuanian"], ["la", "latin"], ["mi", "maori"], ["ml", "malayalam"], ["cy", "welsh"], ["sk", "slovak"], ["te", "telugu"], ["fa", "persian"], ["lv", "latvian"], ["bn", "bengali"], ["sr", "serbian"], ["az", "azerbaijani"], ["sl", "slovenian"], ["kn", "kannada"], ["et", "estonian"], ["mk", "macedonian"], ["br", "breton"], ["eu", "basque"], ["is", "icelandic"], ["hy", "armenian"], ["ne", "nepali"], ["mn", "mongolian"], ["bs", "bosnian"], ["kk", "kazakh"], ["sq", "albanian"], ["sw", "swahili"], ["gl", "galician"], ["mr", "marathi"], ["pa", "punjabi"], ["si", "sinhala"], ["km", "khmer"], ["sn", "shona"], ["yo", "yoruba"], ["so", "somali"], ["af", "afrikaans"], ["oc", "occitan"], ["ka", "georgian"], ["be", "belarusian"], ["tg", "tajik"], ["sd", "sindhi"], ["gu", "gujarati"], ["am", "amharic"], ["yi", "yiddish"], ["lo", "lao"], ["uz", "uzbek"], ["fo", "faroese"], ["ht", "haitian creole"], ["ps", "pashto"], ["tk", "turkmen"], ["nn", "nynorsk"], ["mt", "maltese"], ["sa", "sanskrit"], ["lb", "luxembourgish"], ["my", "myanmar"], ["bo", "tibetan"], ["tl", "tagalog"], ["mg", "malagasy"], ["as", "assamese"], ["tt", "tatar"], ["haw", "hawaiian"], ["ln", "lingala"], ["ha", "hausa"], ["ba", "bashkir"], ["jw", "javanese"], ["su", "sundanese"]]
          , h = new Map(l)
          , b = new Map([...l.map( ([C,M]) => [M, C]), ["burmese", "my"], ["valencian", "ca"], ["flemish", "nl"], ["haitian", "ht"], ["letzeburgesch", "lb"], ["pushto", "ps"], ["panjabi", "pa"], ["moldavian", "ro"], ["moldovan", "ro"], ["sinhalese", "si"], ["castilian", "es"]]);
        function R(C) {
            C = C.toLowerCase();
            let M = b.get(C);
            if (M === void 0) {
                let f = C.match(/^<\|([a-z]{2})\|>$/);
                if (f && (C = f[1]),
                h.has(C))
                    M = C;
                else {
                    let _ = C.length === 2 ? h.keys() : h.values();
                    throw new Error(`Language "${C}" is not supported. Must be one of: ${JSON.stringify(Array.from(_))}`)
                }
            }
            return M
        }
    }
    ),
    "./src/models/whisper/feature_extraction_whisper.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            WhisperFeatureExtractor: () => C
        });
        var l = e("./src/base/feature_extraction_utils.js")
          , h = e("./src/utils/tensor.js")
          , b = e("./src/utils/audio.js")
          , R = e("./src/utils/maths.js");
        class C extends l.FeatureExtractor {
            constructor(f) {
                super(f),
                this.config.mel_filters ??= (0,
                b.mel_filter_bank)(Math.floor(1 + this.config.n_fft / 2), this.config.feature_size, 0, 8e3, this.config.sampling_rate, "slaney", "slaney"),
                this.window = (0,
                b.window_function)(this.config.n_fft, "hann")
            }
            async _extract_fbank_features(f) {
                let L = await (0,
                b.spectrogram)(f, this.window, this.config.n_fft, this.config.hop_length, {
                    power: 2,
                    mel_filters: this.config.mel_filters,
                    log_mel: "log10",
                    max_num_frames: Math.min(Math.floor(f.length / this.config.hop_length), this.config.nb_max_frames)
                })
                  , _ = L.data
                  , a = (0,
                R.max)(_)[0];
                for (let v = 0; v < _.length; ++v)
                    _[v] = (Math.max(_[v], a - 8) + 4) / 4;
                return L
            }
            async _call(f, {max_length: L=null}={}) {
                (0,
                l.validate_audio_inputs)(f, "WhisperFeatureExtractor");
                let _, a = L ?? this.config.n_samples;
                return f.length > a ? (f.length > this.config.n_samples && console.warn("Attempting to extract features for audio longer than 30 seconds. If using a pipeline to extract transcript from a long audio clip, remember to specify `chunk_length_s` and/or `stride_length_s`."),
                _ = f.slice(0, a)) : (_ = new Float32Array(a),
                _.set(f)),
                {
                    input_features: (await this._extract_fbank_features(_)).unsqueeze_(0)
                }
            }
        }
    }
    ),
    "./src/models/whisper/generation_whisper.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            WhisperGenerationConfig: () => h
        });
        var l = e("./src/generation/configuration_utils.js");
        class h extends l.GenerationConfig {
            return_timestamps = null;
            return_token_timestamps = null;
            num_frames = null;
            alignment_heads = null;
            task = null;
            language = null;
            no_timestamps_token_id = null;
            prompt_ids = null;
            is_multilingual = null;
            lang_to_id = null;
            task_to_id = null;
            max_initial_timestamp_index = 1
        }
    }
    ),
    "./src/models/whisper/processing_whisper.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            WhisperProcessor: () => R
        });
        var l = e("./src/models/auto/feature_extraction_auto.js")
          , h = e("./src/tokenizers.js")
          , b = e("./src/base/processing_utils.js");
        class R extends b.Processor {
            static tokenizer_class = h.AutoTokenizer;
            static feature_extractor_class = l.AutoFeatureExtractor;
            async _call(M) {
                return await this.feature_extractor(M)
            }
        }
    }
    ),
    "./src/models/yolos/image_processing_yolos.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            YolosFeatureExtractor: () => b,
            YolosImageProcessor: () => h
        });
        var l = e("./src/base/image_processors_utils.js");
        class h extends l.ImageProcessor {
            post_process_object_detection(...C) {
                return (0,
                l.post_process_object_detection)(...C)
            }
        }
        class b extends h {
        }
    }
    ),
    "./src/ops/registry.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            TensorOpRegistry: () => R
        });
        var l = e("./src/backends/onnx.js")
          , h = e("./src/utils/tensor.js");
        let b = async (C, M, f) => {
            let L = await (0,
            l.createInferenceSession)(new Uint8Array(C), M);
            return (async _ => {
                let a = (0,
                l.isONNXProxy)()
                  , v = Object.fromEntries(Object.entries(_).map( ([y,W]) => [y, (a ? W.clone() : W).ort_tensor]))
                  , g = await (0,
                l.runInferenceSession)(L, v);
                return Array.isArray(f) ? f.map(y => new h.Tensor(g[y])) : new h.Tensor(g[f])
            }
            )
        }
        ;
        class R {
            static session_options = {};
            static get nearest_interpolate_4d() {
                return this._nearest_interpolate_4d || (this._nearest_interpolate_4d = b([8, 10, 18, 0, 58, 129, 1, 10, 41, 10, 1, 120, 10, 0, 10, 0, 10, 1, 115, 18, 1, 121, 34, 6, 82, 101, 115, 105, 122, 101, 42, 18, 10, 4, 109, 111, 100, 101, 34, 7, 110, 101, 97, 114, 101, 115, 116, 160, 1, 3, 18, 1, 114, 90, 31, 10, 1, 120, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 90, 15, 10, 1, 115, 18, 10, 10, 8, 8, 7, 18, 4, 10, 2, 8, 4, 98, 31, 10, 1, 121, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 66, 2, 16, 21], this.session_options, "y")),
                this._nearest_interpolate_4d
            }
            static get bilinear_interpolate_4d() {
                return this._bilinear_interpolate_4d || (this._bilinear_interpolate_4d = b([8, 9, 18, 0, 58, 128, 1, 10, 40, 10, 1, 120, 10, 0, 10, 0, 10, 1, 115, 18, 1, 121, 34, 6, 82, 101, 115, 105, 122, 101, 42, 17, 10, 4, 109, 111, 100, 101, 34, 6, 108, 105, 110, 101, 97, 114, 160, 1, 3, 18, 1, 114, 90, 31, 10, 1, 120, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 90, 15, 10, 1, 115, 18, 10, 10, 8, 8, 7, 18, 4, 10, 2, 8, 4, 98, 31, 10, 1, 121, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 66, 2, 16, 20], this.session_options, "y")),
                this._bilinear_interpolate_4d
            }
            static get bicubic_interpolate_4d() {
                return this._bicubic_interpolate_4d || (this._bicubic_interpolate_4d = b([8, 9, 18, 0, 58, 127, 10, 39, 10, 1, 120, 10, 0, 10, 0, 10, 1, 115, 18, 1, 121, 34, 6, 82, 101, 115, 105, 122, 101, 42, 16, 10, 4, 109, 111, 100, 101, 34, 5, 99, 117, 98, 105, 99, 160, 1, 3, 18, 1, 114, 90, 31, 10, 1, 120, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 90, 15, 10, 1, 115, 18, 10, 10, 8, 8, 7, 18, 4, 10, 2, 8, 4, 98, 31, 10, 1, 121, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 99, 10, 3, 18, 1, 104, 10, 3, 18, 1, 119, 66, 2, 16, 20], this.session_options, "y")),
                this._bicubic_interpolate_4d
            }
            static get matmul() {
                return this._matmul || (this._matmul = b([8, 9, 18, 0, 58, 55, 10, 17, 10, 1, 97, 10, 1, 98, 18, 1, 99, 34, 6, 77, 97, 116, 77, 117, 108, 18, 1, 114, 90, 9, 10, 1, 97, 18, 4, 10, 2, 8, 1, 90, 9, 10, 1, 98, 18, 4, 10, 2, 8, 1, 98, 9, 10, 1, 99, 18, 4, 10, 2, 8, 1, 66, 2, 16, 20], this.session_options, "c")),
                this._matmul
            }
            static get stft() {
                return this._stft || (this._stft = b([8, 7, 18, 0, 58, 148, 1, 10, 38, 10, 1, 115, 10, 1, 106, 10, 1, 119, 10, 1, 108, 18, 1, 111, 34, 4, 83, 84, 70, 84, 42, 15, 10, 8, 111, 110, 101, 115, 105, 100, 101, 100, 24, 1, 160, 1, 2, 18, 1, 115, 90, 26, 10, 1, 115, 18, 21, 10, 19, 8, 1, 18, 15, 10, 3, 18, 1, 98, 10, 3, 18, 1, 115, 10, 3, 18, 1, 99, 90, 11, 10, 1, 106, 18, 6, 10, 4, 8, 7, 18, 0, 90, 16, 10, 1, 119, 18, 11, 10, 9, 8, 1, 18, 5, 10, 3, 18, 1, 119, 90, 11, 10, 1, 108, 18, 6, 10, 4, 8, 7, 18, 0, 98, 31, 10, 1, 111, 18, 26, 10, 24, 8, 1, 18, 20, 10, 3, 18, 1, 98, 10, 3, 18, 1, 102, 10, 3, 18, 1, 100, 10, 3, 18, 1, 99, 66, 2, 16, 17], this.session_options, "o")),
                this._stft
            }
            static get rfft() {
                return this._rfft || (this._rfft = b([8, 9, 18, 0, 58, 97, 10, 33, 10, 1, 120, 10, 0, 10, 1, 97, 18, 1, 121, 34, 3, 68, 70, 84, 42, 15, 10, 8, 111, 110, 101, 115, 105, 100, 101, 100, 24, 1, 160, 1, 2, 18, 1, 100, 90, 21, 10, 1, 120, 18, 16, 10, 14, 8, 1, 18, 10, 10, 3, 18, 1, 115, 10, 3, 18, 1, 99, 90, 11, 10, 1, 97, 18, 6, 10, 4, 8, 7, 18, 0, 98, 21, 10, 1, 121, 18, 16, 10, 14, 8, 1, 18, 10, 10, 3, 18, 1, 115, 10, 3, 18, 1, 99, 66, 2, 16, 20], this.session_options, "y")),
                this._rfft
            }
            static get top_k() {
                return this._top_k || (this._top_k = b([8, 10, 18, 0, 58, 73, 10, 18, 10, 1, 120, 10, 1, 107, 18, 1, 118, 18, 1, 105, 34, 4, 84, 111, 112, 75, 18, 1, 116, 90, 9, 10, 1, 120, 18, 4, 10, 2, 8, 1, 90, 15, 10, 1, 107, 18, 10, 10, 8, 8, 7, 18, 4, 10, 2, 8, 1, 98, 9, 10, 1, 118, 18, 4, 10, 2, 8, 1, 98, 9, 10, 1, 105, 18, 4, 10, 2, 8, 7, 66, 2, 16, 21], this.session_options, ["v", "i"])),
                this._top_k
            }
            static get slice() {
                return this._slice || (this._slice = b([8, 7, 18, 0, 58, 96, 10, 25, 10, 1, 120, 10, 1, 115, 10, 1, 101, 10, 1, 97, 10, 1, 116, 18, 1, 121, 34, 5, 83, 108, 105, 99, 101, 18, 1, 114, 90, 9, 10, 1, 120, 18, 4, 10, 2, 8, 1, 90, 9, 10, 1, 115, 18, 4, 10, 2, 8, 7, 90, 9, 10, 1, 101, 18, 4, 10, 2, 8, 7, 90, 9, 10, 1, 97, 18, 4, 10, 2, 8, 7, 90, 9, 10, 1, 116, 18, 4, 10, 2, 8, 7, 98, 9, 10, 1, 121, 18, 4, 10, 2, 8, 1, 66, 2, 16, 13], this.session_options, "y")),
                this._slice
            }
        }
    }
    ),
    "./src/pipelines.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AudioClassificationPipeline: () => D,
            AutomaticSpeechRecognitionPipeline: () => U,
            BackgroundRemovalPipeline: () => le,
            DepthEstimationPipeline: () => ae,
            DocumentQuestionAnsweringPipeline: () => A,
            FeatureExtractionPipeline: () => N,
            FillMaskPipeline: () => p,
            ImageClassificationPipeline: () => Z,
            ImageFeatureExtractionPipeline: () => j,
            ImageSegmentationPipeline: () => ee,
            ImageToImagePipeline: () => J,
            ImageToTextPipeline: () => H,
            ObjectDetectionPipeline: () => ce,
            Pipeline: () => W,
            QuestionAnsweringPipeline: () => I,
            SummarizationPipeline: () => E,
            Text2TextGenerationPipeline: () => m,
            TextClassificationPipeline: () => T,
            TextGenerationPipeline: () => x,
            TextToAudioPipeline: () => V,
            TokenClassificationPipeline: () => k,
            TranslationPipeline: () => o,
            ZeroShotAudioClassificationPipeline: () => $,
            ZeroShotClassificationPipeline: () => S,
            ZeroShotImageClassificationPipeline: () => we,
            ZeroShotObjectDetectionPipeline: () => Q,
            pipeline: () => Ae
        });
        var l = e("./src/tokenizers.js")
          , h = e("./src/models.js")
          , b = e("./src/models/auto/processing_auto.js")
          , R = e("./src/base/processing_utils.js")
          , C = e("./src/utils/generic.js")
          , M = e("./src/utils/core.js")
          , f = e("./src/utils/maths.js")
          , L = e("./src/utils/audio.js")
          , _ = e("./src/utils/tensor.js")
          , a = e("./src/utils/image.js");
        async function v(he) {
            return Array.isArray(he) || (he = [he]),
            await Promise.all(he.map(c => a.RawImage.read(c)))
        }
        async function g(he, c) {
            return Array.isArray(he) || (he = [he]),
            await Promise.all(he.map(Y => typeof Y == "string" || Y instanceof URL ? (0,
            L.read_audio)(Y, c) : Y instanceof Float64Array ? new Float32Array(Y) : Y))
        }
        function y(he, c) {
            c && (he = he.map(re => re | 0));
            let[Y,_e,ue,Me] = he;
            return {
                xmin: Y,
                ymin: _e,
                xmax: ue,
                ymax: Me
            }
        }
        class W extends C.Callable {
            constructor({task: c, model: Y, tokenizer: _e=null, processor: ue=null}) {
                super(),
                this.task = c,
                this.model = Y,
                this.tokenizer = _e,
                this.processor = ue
            }
            async dispose() {
                await this.model.dispose()
            }
        }
        class T extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {top_k: Y=1}={}) {
                let _e = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                })
                  , ue = await this.model(_e)
                  , Me = this.model.config.problem_type === "multi_label_classification" ? se => se.sigmoid() : se => new _.Tensor("float32",(0,
                f.softmax)(se.data),se.dims)
                  , re = this.model.config.id2label
                  , pe = [];
                for (let se of ue.logits) {
                    let Te = Me(se)
                      , Ee = await (0,
                    _.topk)(Te, Y)
                      , ye = Ee[0].tolist()
                      , Se = Ee[1].tolist().map( (De, Ve) => ({
                        label: re ? re[De] : `LABEL_${De}`,
                        score: ye[Ve]
                    }));
                    Y === 1 ? pe.push(...Se) : pe.push(Se)
                }
                return Array.isArray(c) || Y === 1 ? pe : pe[0]
            }
        }
        class k extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {ignore_labels: Y=["O"]}={}) {
                let _e = Array.isArray(c)
                  , ue = this.tokenizer(_e ? c : [c], {
                    padding: !0,
                    truncation: !0
                })
                  , re = (await this.model(ue)).logits
                  , pe = this.model.config.id2label
                  , se = [];
                for (let Te = 0; Te < re.dims[0]; ++Te) {
                    let Ee = ue.input_ids[Te]
                      , ye = re[Te]
                      , Pe = [];
                    for (let Se = 0; Se < ye.dims[0]; ++Se) {
                        let De = ye[Se]
                          , Ve = (0,
                        f.max)(De.data)[1]
                          , Re = pe ? pe[Ve] : `LABEL_${Ve}`;
                        if (Y.includes(Re))
                            continue;
                        let $e = this.tokenizer.decode([Ee[Se].item()], {
                            skip_special_tokens: !0
                        });
                        if ($e === "")
                            continue;
                        let ze = (0,
                        f.softmax)(De.data);
                        Pe.push({
                            entity: Re,
                            score: ze[Ve],
                            index: Se,
                            word: $e
                        })
                    }
                    se.push(Pe)
                }
                return _e ? se : se[0]
            }
        }
        class I extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y, {top_k: _e=1}={}) {
                let ue = this.tokenizer(c, {
                    text_pair: Y,
                    padding: !0,
                    truncation: !0
                })
                  , {start_logits: Me, end_logits: re} = await this.model(ue)
                  , pe = ue.input_ids.tolist()
                  , se = ue.attention_mask.tolist()
                  , Te = this.tokenizer.all_special_ids
                  , Ee = [];
                for (let ye = 0; ye < Me.dims[0]; ++ye) {
                    let Pe = pe[ye]
                      , Se = Pe.findIndex(Ie => Ie == this.tokenizer.sep_token_id)
                      , De = se[ye].map( (Ie, st) => Ie == 1 && (st === 0 || st > Se && Te.findIndex(qe => qe == Pe[st]) === -1))
                      , Ve = Me[ye].tolist()
                      , Re = re[ye].tolist();
                    for (let Ie = 1; Ie < Ve.length; ++Ie)
                        (se[ye] == 0 || Ie <= Se || Te.findIndex(st => st == Pe[Ie]) !== -1) && (Ve[Ie] = -1 / 0,
                        Re[Ie] = -1 / 0);
                    let $e = (0,
                    f.softmax)(Ve).map( (Ie, st) => [Ie, st])
                      , ze = (0,
                    f.softmax)(Re).map( (Ie, st) => [Ie, st]);
                    $e[0][0] = 0,
                    ze[0][0] = 0;
                    let Ze = (0,
                    M.product)($e, ze).filter(Ie => Ie[0][1] <= Ie[1][1]).map(Ie => [Ie[0][1], Ie[1][1], Ie[0][0] * Ie[1][0]]).sort( (Ie, st) => st[2] - Ie[2]);
                    for (let Ie = 0; Ie < Math.min(Ze.length, _e); ++Ie) {
                        let[st,qe,ht] = Ze[Ie]
                          , Kt = Pe.slice(st, qe + 1)
                          , Zt = this.tokenizer.decode(Kt, {
                            skip_special_tokens: !0
                        });
                        Ee.push({
                            answer: Zt,
                            score: ht
                        })
                    }
                }
                return _e === 1 ? Ee[0] : Ee
            }
        }
        class p extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {top_k: Y=5}={}) {
                let _e = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                })
                  , {logits: ue} = await this.model(_e)
                  , Me = []
                  , re = _e.input_ids.tolist();
                for (let pe = 0; pe < re.length; ++pe) {
                    let se = re[pe]
                      , Te = se.findIndex(De => De == this.tokenizer.mask_token_id);
                    if (Te === -1)
                        throw Error(`Mask token (${this.tokenizer.mask_token}) not found in text.`);
                    let Ee = ue[pe][Te]
                      , ye = await (0,
                    _.topk)(new _.Tensor("float32",(0,
                    f.softmax)(Ee.data),Ee.dims), Y)
                      , Pe = ye[0].tolist()
                      , Se = ye[1].tolist();
                    Me.push(Se.map( (De, Ve) => {
                        let Re = se.slice();
                        return Re[Te] = De,
                        {
                            score: Pe[Ve],
                            token: Number(De),
                            token_str: this.tokenizer.decode([De]),
                            sequence: this.tokenizer.decode(Re, {
                                skip_special_tokens: !0
                            })
                        }
                    }
                    ))
                }
                return Array.isArray(c) ? Me : Me[0]
            }
        }
        class m extends W {
            _key = "generated_text";
            constructor(c) {
                super(c)
            }
            async _call(c, Y={}) {
                Array.isArray(c) || (c = [c]),
                this.model.config.prefix && (c = c.map(se => this.model.config.prefix + se));
                let _e = this.model.config.task_specific_params;
                _e && _e[this.task] && _e[this.task].prefix && (c = c.map(se => _e[this.task].prefix + se));
                let ue = this.tokenizer, Me = {
                    padding: !0,
                    truncation: !0
                }, re;
                this instanceof o && "_build_translation_inputs"in ue ? re = ue._build_translation_inputs(c, Me, Y) : re = ue(c, Me);
                let pe = await this.model.generate({
                    ...re,
                    ...Y
                });
                return ue.batch_decode(pe, {
                    skip_special_tokens: !0
                }).map(se => ({
                    [this._key]: se
                }))
            }
        }
        class E extends m {
            _key = "summary_text";
            constructor(c) {
                super(c)
            }
        }
        class o extends m {
            _key = "translation_text";
            constructor(c) {
                super(c)
            }
        }
        function d(he) {
            return Array.isArray(he) && he.every(c => "role"in c && "content"in c)
        }
        class x extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y={}) {
                let _e = !1, ue = !1, Me = Y.add_special_tokens ?? (this.tokenizer.add_bos_token || this.tokenizer.add_eos_token) ?? !1, re;
                if (typeof c == "string")
                    re = c = [c];
                else if (Array.isArray(c) && c.every(Se => typeof Se == "string"))
                    _e = !0,
                    re = c;
                else {
                    if (d(c))
                        c = [c];
                    else if (Array.isArray(c) && c.every(d))
                        _e = !0;
                    else
                        throw new Error("Input must be a string, an array of strings, a Chat, or an array of Chats");
                    ue = !0,
                    re = c.map(Se => this.tokenizer.apply_chat_template(Se, {
                        tokenize: !1,
                        add_generation_prompt: !0
                    })),
                    Me = !1
                }
                let pe = ue ? !1 : Y.return_full_text ?? !0;
                this.tokenizer.padding_side = "left";
                let se = this.tokenizer(re, {
                    add_special_tokens: Me,
                    padding: !0,
                    truncation: !0
                }), Te = await this.model.generate({
                    ...se,
                    ...Y
                }), Ee = this.tokenizer.batch_decode(Te, {
                    skip_special_tokens: !0
                }), ye;
                !pe && se.input_ids.dims.at(-1) > 0 && (ye = this.tokenizer.batch_decode(se.input_ids, {
                    skip_special_tokens: !0
                }).map(Se => Se.length));
                let Pe = Array.from({
                    length: c.length
                }, Se => []);
                for (let Se = 0; Se < Ee.length; ++Se) {
                    let De = Math.floor(Se / Te.dims[0] * c.length);
                    ye && (Ee[Se] = Ee[Se].slice(ye[De])),
                    Pe[De].push({
                        generated_text: ue ? [...c[De], {
                            role: "assistant",
                            content: Ee[Se]
                        }] : Ee[Se]
                    })
                }
                return !_e && Pe.length === 1 ? Pe[0] : Pe
            }
        }
        class S extends W {
            constructor(c) {
                super(c),
                this.label2id = Object.fromEntries(Object.entries(this.model.config.label2id).map( ([Y,_e]) => [Y.toLowerCase(), _e])),
                this.entailment_id = this.label2id.entailment,
                this.entailment_id === void 0 && (console.warn("Could not find 'entailment' in label2id mapping. Using 2 as entailment_id."),
                this.entailment_id = 2),
                this.contradiction_id = this.label2id.contradiction ?? this.label2id.not_entailment,
                this.contradiction_id === void 0 && (console.warn("Could not find 'contradiction' in label2id mapping. Using 0 as contradiction_id."),
                this.contradiction_id = 0)
            }
            async _call(c, Y, {hypothesis_template: _e="This example is {}.", multi_label: ue=!1}={}) {
                let Me = Array.isArray(c);
                Me || (c = [c]),
                Array.isArray(Y) || (Y = [Y]);
                let re = Y.map(Te => _e.replace("{}", Te))
                  , pe = ue || Y.length === 1
                  , se = [];
                for (let Te of c) {
                    let Ee = [];
                    for (let Se of re) {
                        let De = this.tokenizer(Te, {
                            text_pair: Se,
                            padding: !0,
                            truncation: !0
                        })
                          , Ve = await this.model(De);
                        pe ? Ee.push([Ve.logits.data[this.contradiction_id], Ve.logits.data[this.entailment_id]]) : Ee.push(Ve.logits.data[this.entailment_id])
                    }
                    let Pe = (pe ? Ee.map(Se => (0,
                    f.softmax)(Se)[1]) : (0,
                    f.softmax)(Ee)).map( (Se, De) => [Se, De]).sort( (Se, De) => De[0] - Se[0]);
                    se.push({
                        sequence: Te,
                        labels: Pe.map(Se => Y[Se[1]]),
                        scores: Pe.map(Se => Se[0])
                    })
                }
                return Me ? se : se[0]
            }
        }
        class N extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {pooling: Y="none", normalize: _e=!1, quantize: ue=!1, precision: Me="binary"}={}) {
                let re = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                })
                  , pe = await this.model(re)
                  , se = pe.last_hidden_state ?? pe.logits ?? pe.token_embeddings;
                switch (Y) {
                case "none":
                    break;
                case "mean":
                    se = (0,
                    _.mean_pooling)(se, re.attention_mask);
                    break;
                case "first_token":
                case "cls":
                    se = se.slice(null, 0);
                    break;
                case "last_token":
                case "eos":
                    se = se.slice(null, -1);
                    break;
                default:
                    throw Error(`Pooling method '${Y}' not supported.`)
                }
                return _e && (se = se.normalize(2, -1)),
                ue && (se = (0,
                _.quantize_embeddings)(se, Me)),
                se
            }
        }
        class j extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {pool: Y=null}={}) {
                let _e = await v(c), {pixel_values: ue} = await this.processor(_e), Me = await this.model({
                    pixel_values: ue
                }), re;
                if (Y) {
                    if (!("pooler_output"in Me))
                        throw Error("No pooled output was returned. Make sure the model has a 'pooler' layer when using the 'pool' option.");
                    re = Me.pooler_output
                } else
                    re = Me.last_hidden_state ?? Me.logits ?? Me.image_embeds;
                return re
            }
        }
        class D extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {top_k: Y=5}={}) {
                let _e = this.processor.feature_extractor.config.sampling_rate
                  , ue = await g(c, _e)
                  , Me = this.model.config.id2label
                  , re = [];
                for (let pe of ue) {
                    let se = await this.processor(pe)
                      , Ee = (await this.model(se)).logits[0]
                      , ye = await (0,
                    _.topk)(new _.Tensor("float32",(0,
                    f.softmax)(Ee.data),Ee.dims), Y)
                      , Pe = ye[0].tolist()
                      , De = ye[1].tolist().map( (Ve, Re) => ({
                        label: Me ? Me[Ve] : `LABEL_${Ve}`,
                        score: Pe[Re]
                    }));
                    re.push(De)
                }
                return Array.isArray(c) ? re : re[0]
            }
        }
        class $ extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y, {hypothesis_template: _e="This is a sound of {}."}={}) {
                let ue = !Array.isArray(c);
                ue && (c = [c]);
                let Me = Y.map(Ee => _e.replace("{}", Ee))
                  , re = this.tokenizer(Me, {
                    padding: !0,
                    truncation: !0
                })
                  , pe = this.processor.feature_extractor.config.sampling_rate
                  , se = await g(c, pe)
                  , Te = [];
                for (let Ee of se) {
                    let ye = await this.processor(Ee)
                      , Pe = await this.model({
                        ...re,
                        ...ye
                    })
                      , Se = (0,
                    f.softmax)(Pe.logits_per_audio.data);
                    Te.push([...Se].map( (De, Ve) => ({
                        score: De,
                        label: Y[Ve]
                    })))
                }
                return ue ? Te[0] : Te
            }
        }
        class U extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y={}) {
                switch (this.model.config.model_type) {
                case "whisper":
                case "lite-whisper":
                    return this._call_whisper(c, Y);
                case "wav2vec2":
                case "wav2vec2-bert":
                case "unispeech":
                case "unispeech-sat":
                case "hubert":
                case "parakeet_ctc":
                    return this._call_wav2vec2(c, Y);
                case "moonshine":
                    return this._call_moonshine(c, Y);
                default:
                    throw new Error(`AutomaticSpeechRecognitionPipeline does not support model type '${this.model.config.model_type}'.`)
                }
            }
            async _call_wav2vec2(c, Y) {
                Y.language && console.warn('`language` parameter is not yet supported for `wav2vec2` models, defaulting to "English".'),
                Y.task && console.warn('`task` parameter is not yet supported for `wav2vec2` models, defaulting to "transcribe".');
                let _e = !Array.isArray(c);
                _e && (c = [c]);
                let ue = this.processor.feature_extractor.config.sampling_rate
                  , Me = await g(c, ue)
                  , re = [];
                for (let pe of Me) {
                    let se = await this.processor(pe)
                      , Ee = (await this.model(se)).logits[0]
                      , ye = [];
                    for (let Se of Ee)
                        ye.push((0,
                        f.max)(Se.data)[1]);
                    let Pe = this.tokenizer.decode(ye, {
                        skip_special_tokens: !0
                    }).trim();
                    re.push({
                        text: Pe
                    })
                }
                return _e ? re[0] : re
            }
            async _call_whisper(c, Y) {
                let _e = Y.return_timestamps ?? !1
                  , ue = Y.chunk_length_s ?? 0
                  , Me = Y.force_full_sequences ?? !1
                  , re = Y.stride_length_s ?? null
                  , pe = {
                    ...Y
                };
                _e === "word" && (pe.return_token_timestamps = !0,
                pe.return_timestamps = !1);
                let se = !Array.isArray(c);
                se && (c = [c]);
                let Te = this.processor.feature_extractor.config.chunk_length / this.model.config.max_source_positions
                  , Ee = this.processor.feature_extractor.config.hop_length
                  , ye = this.processor.feature_extractor.config.sampling_rate
                  , Pe = await g(c, ye)
                  , Se = [];
                for (let De of Pe) {
                    let Ve = [];
                    if (ue > 0) {
                        if (re === null)
                            re = ue / 6;
                        else if (ue <= re)
                            throw Error("`chunk_length_s` must be larger than `stride_length_s`.");
                        let ze = ye * ue
                          , Ze = ye * re
                          , Ie = ze - 2 * Ze
                          , st = 0;
                        for (; ; ) {
                            let qe = st + ze
                              , ht = De.subarray(st, qe)
                              , Kt = await this.processor(ht)
                              , Zt = st === 0
                              , Gt = qe >= De.length;
                            if (Ve.push({
                                stride: [ht.length, Zt ? 0 : Ze, Gt ? 0 : Ze],
                                input_features: Kt.input_features,
                                is_last: Gt
                            }),
                            Gt)
                                break;
                            st += Ie
                        }
                    } else
                        Ve = [{
                            stride: [De.length, 0, 0],
                            input_features: (await this.processor(De)).input_features,
                            is_last: !0
                        }];
                    for (let ze of Ve) {
                        pe.num_frames = Math.floor(ze.stride[0] / Ee);
                        let Ze = await this.model.generate({
                            inputs: ze.input_features,
                            ...pe
                        });
                        _e === "word" ? (ze.tokens = Ze.sequences.tolist()[0],
                        ze.token_timestamps = Ze.token_timestamps.tolist()[0].map(Ie => (0,
                        f.round)(Ie, 2))) : ze.tokens = Ze[0].tolist(),
                        ze.stride = ze.stride.map(Ie => Ie / ye)
                    }
                    let[Re,$e] = this.tokenizer._decode_asr(Ve, {
                        time_precision: Te,
                        return_timestamps: _e,
                        force_full_sequences: Me
                    });
                    Se.push({
                        text: Re,
                        ...$e
                    })
                }
                return se ? Se[0] : Se
            }
            async _call_moonshine(c, Y) {
                let _e = !Array.isArray(c);
                _e && (c = [c]);
                let ue = this.processor.feature_extractor.config.sampling_rate
                  , Me = await g(c, ue)
                  , re = [];
                for (let pe of Me) {
                    let se = await this.processor(pe)
                      , Te = Math.floor(pe.length / ue) * 6
                      , Ee = await this.model.generate({
                        max_new_tokens: Te,
                        ...Y,
                        ...se
                    })
                      , ye = this.processor.batch_decode(Ee, {
                        skip_special_tokens: !0
                    })[0];
                    re.push({
                        text: ye
                    })
                }
                return _e ? re[0] : re
            }
        }
        class H extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y={}) {
                let _e = Array.isArray(c)
                  , ue = await v(c)
                  , {pixel_values: Me} = await this.processor(ue)
                  , re = [];
                for (let pe of Me) {
                    pe.dims = [1, ...pe.dims];
                    let se = await this.model.generate({
                        inputs: pe,
                        ...Y
                    })
                      , Te = this.tokenizer.batch_decode(se, {
                        skip_special_tokens: !0
                    }).map(Ee => ({
                        generated_text: Ee.trim()
                    }));
                    re.push(Te)
                }
                return _e ? re : re[0]
            }
        }
        class Z extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {top_k: Y=5}={}) {
                let _e = await v(c)
                  , {pixel_values: ue} = await this.processor(_e)
                  , Me = await this.model({
                    pixel_values: ue
                })
                  , re = this.model.config.id2label
                  , pe = [];
                for (let se of Me.logits) {
                    let Te = await (0,
                    _.topk)(new _.Tensor("float32",(0,
                    f.softmax)(se.data),se.dims), Y)
                      , Ee = Te[0].tolist()
                      , Pe = Te[1].tolist().map( (Se, De) => ({
                        label: re ? re[Se] : `LABEL_${Se}`,
                        score: Ee[De]
                    }));
                    pe.push(Pe)
                }
                return Array.isArray(c) ? pe : pe[0]
            }
        }
        class ee extends W {
            constructor(c) {
                super(c),
                this.subtasks_mapping = {
                    panoptic: "post_process_panoptic_segmentation",
                    instance: "post_process_instance_segmentation",
                    semantic: "post_process_semantic_segmentation"
                }
            }
            async _call(c, {threshold: Y=.5, mask_threshold: _e=.5, overlap_mask_area_threshold: ue=.8, label_ids_to_fuse: Me=null, target_sizes: re=null, subtask: pe=null}={}) {
                if (Array.isArray(c) && c.length !== 1)
                    throw Error("Image segmentation pipeline currently only supports a batch size of 1.");
                let Te = await v(c)
                  , Ee = Te.map(ze => [ze.height, ze.width])
                  , ye = await this.processor(Te)
                  , {inputNames: Pe, outputNames: Se} = this.model.sessions.model;
                if (!Pe.includes("pixel_values")) {
                    if (Pe.length !== 1)
                        throw Error(`Expected a single input name, but got ${Pe.length} inputs: ${Pe}.`);
                    let ze = Pe[0];
                    if (ze in ye)
                        throw Error(`Input name ${ze} already exists in the inputs.`);
                    ye[ze] = ye.pixel_values
                }
                let De = await this.model(ye)
                  , Ve = null;
                if (pe !== null)
                    Ve = this.subtasks_mapping[pe];
                else if (this.processor.image_processor) {
                    for (let[ze,Ze] of Object.entries(this.subtasks_mapping))
                        if (Ze in this.processor.image_processor) {
                            Ve = this.processor.image_processor[Ze].bind(this.processor.image_processor),
                            pe = ze;
                            break
                        }
                }
                let Re = this.model.config.id2label
                  , $e = [];
                if (pe)
                    if (pe === "panoptic" || pe === "instance") {
                        let ze = Ve(De, Y, _e, ue, Me, re ?? Ee)[0]
                          , Ze = ze.segmentation;
                        for (let Ie of ze.segments_info) {
                            let st = new Uint8ClampedArray(Ze.data.length);
                            for (let ht = 0; ht < Ze.data.length; ++ht)
                                Ze.data[ht] === Ie.id && (st[ht] = 255);
                            let qe = new a.RawImage(st,Ze.dims[1],Ze.dims[0],1);
                            $e.push({
                                score: Ie.score,
                                label: Re[Ie.label_id],
                                mask: qe
                            })
                        }
                    } else if (pe === "semantic") {
                        let {segmentation: ze, labels: Ze} = Ve(De, re ?? Ee)[0];
                        for (let Ie of Ze) {
                            let st = new Uint8ClampedArray(ze.data.length);
                            for (let ht = 0; ht < ze.data.length; ++ht)
                                ze.data[ht] === Ie && (st[ht] = 255);
                            let qe = new a.RawImage(st,ze.dims[1],ze.dims[0],1);
                            $e.push({
                                score: null,
                                label: Re[Ie],
                                mask: qe
                            })
                        }
                    } else
                        throw Error(`Subtask ${pe} not supported.`);
                else {
                    let Ze = De[Se[0]];
                    for (let Ie = 0; Ie < Ee.length; ++Ie) {
                        let st = Ee[Ie]
                          , qe = Ze[Ie];
                        qe.data.some(Kt => Kt < -1e-5 || Kt > 1 + 1e-5) && qe.sigmoid_();
                        let ht = await a.RawImage.fromTensor(qe.mul_(255).to("uint8")).resize(st[1], st[0]);
                        $e.push({
                            label: null,
                            score: null,
                            mask: ht
                        })
                    }
                }
                return $e
            }
        }
        class le extends ee {
            constructor(c) {
                super(c)
            }
            async _call(c, Y={}) {
                if (Array.isArray(c) && c.length !== 1)
                    throw Error("Background removal pipeline currently only supports a batch size of 1.");
                let ue = await v(c)
                  , Me = await super._call(c, Y);
                return ue.map( (pe, se) => {
                    let Te = pe.clone();
                    return Te.putAlpha(Me[se].mask),
                    Te
                }
                )
            }
        }
        class we extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y, {hypothesis_template: _e="This is a photo of {}"}={}) {
                let ue = Array.isArray(c)
                  , Me = await v(c)
                  , re = Y.map(Pe => _e.replace("{}", Pe))
                  , pe = this.tokenizer(re, {
                    padding: this.model.config.model_type === "siglip" ? "max_length" : !0,
                    truncation: !0
                })
                  , {pixel_values: se} = await this.processor(Me)
                  , Te = await this.model({
                    ...pe,
                    pixel_values: se
                })
                  , Ee = this.model.config.model_type === "siglip" ? Pe => Pe.sigmoid().data : Pe => (0,
                f.softmax)(Pe.data)
                  , ye = [];
                for (let Pe of Te.logits_per_image) {
                    let De = [...Ee(Pe)].map( (Ve, Re) => ({
                        score: Ve,
                        label: Y[Re]
                    }));
                    De.sort( (Ve, Re) => Re.score - Ve.score),
                    ye.push(De)
                }
                return ue ? ye : ye[0]
            }
        }
        class ce extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, {threshold: Y=.9, percentage: _e=!1}={}) {
                let ue = Array.isArray(c);
                if (ue && c.length !== 1)
                    throw Error("Object detection pipeline currently only supports a batch size of 1.");
                let Me = await v(c)
                  , re = _e ? null : Me.map(Se => [Se.height, Se.width])
                  , {pixel_values: pe, pixel_mask: se} = await this.processor(Me)
                  , Te = await this.model({
                    pixel_values: pe,
                    pixel_mask: se
                })
                  , Ee = this.processor.image_processor.post_process_object_detection(Te, Y, re)
                  , ye = this.model.config.id2label
                  , Pe = Ee.map(Se => Se.boxes.map( (De, Ve) => ({
                    score: Se.scores[Ve],
                    label: ye[Se.classes[Ve]],
                    box: y(De, !_e)
                })));
                return ue ? Pe : Pe[0]
            }
        }
        class Q extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y, {threshold: _e=.1, top_k: ue=null, percentage: Me=!1}={}) {
                let re = Array.isArray(c)
                  , pe = await v(c)
                  , se = this.tokenizer(Y, {
                    padding: !0,
                    truncation: !0
                })
                  , Te = await this.processor(pe)
                  , Ee = [];
                for (let ye = 0; ye < pe.length; ++ye) {
                    let Pe = pe[ye], Se = Me ? null : [[Pe.height, Pe.width]], De = Te.pixel_values[ye].unsqueeze_(0), Ve = await this.model({
                        ...se,
                        pixel_values: De
                    }), Re;
                    if ("post_process_grounded_object_detection"in this.processor) {
                        let $e = this.processor.post_process_grounded_object_detection(Ve, se.input_ids, {
                            box_threshold: _e,
                            text_threshold: _e,
                            target_sizes: Se
                        })[0];
                        Re = $e.boxes.map( (ze, Ze) => ({
                            score: $e.scores[Ze],
                            label: $e.labels[Ze],
                            box: y(ze, !Me)
                        }))
                    } else {
                        let $e = this.processor.image_processor.post_process_object_detection(Ve, _e, Se, !0)[0];
                        Re = $e.boxes.map( (ze, Ze) => ({
                            score: $e.scores[Ze],
                            label: Y[$e.classes[Ze]],
                            box: y(ze, !Me)
                        }))
                    }
                    Re.sort( ($e, ze) => ze.score - $e.score),
                    ue !== null && (Re = Re.slice(0, ue)),
                    Ee.push(Re)
                }
                return re ? Ee : Ee[0]
            }
        }
        class A extends W {
            constructor(c) {
                super(c)
            }
            async _call(c, Y, _e={}) {
                let ue = (await v(c))[0]
                  , {pixel_values: Me} = await this.processor(ue)
                  , re = `<s_docvqa><s_question>${Y}</s_question><s_answer>`
                  , pe = this.tokenizer(re, {
                    add_special_tokens: !1,
                    padding: !0,
                    truncation: !0
                }).input_ids
                  , se = await this.model.generate({
                    inputs: Me,
                    max_length: this.model.config.decoder.max_position_embeddings,
                    decoder_input_ids: pe,
                    ..._e
                })
                  , Ee = this.tokenizer.batch_decode(se)[0].match(/<s_answer>(.*?)<\/s_answer>/)
                  , ye = null;
                return Ee && Ee.length >= 2 && (ye = Ee[1].trim()),
                [{
                    answer: ye
                }]
            }
        }
        class V extends W {
            DEFAULT_VOCODER_ID = "Xenova/speecht5_hifigan";
            constructor(c) {
                super(c),
                this.vocoder = c.vocoder ?? null
            }
            async _prepare_speaker_embeddings(c) {
                if ((typeof c == "string" || c instanceof URL) && (c = new Float32Array(await (await fetch(c)).arrayBuffer())),
                c instanceof Float32Array)
                    c = new _.Tensor("float32",c,[c.length]);
                else if (!(c instanceof _.Tensor))
                    throw new Error("Speaker embeddings must be a `Tensor`, `Float32Array`, `string`, or `URL`.");
                return c
            }
            async _call(c, {speaker_embeddings: Y=null, num_inference_steps: _e, speed: ue}={}) {
                return this.processor ? this._call_text_to_spectrogram(c, {
                    speaker_embeddings: Y
                }) : this.model.config.model_type === "supertonic" ? this._call_supertonic(c, {
                    speaker_embeddings: Y,
                    num_inference_steps: _e,
                    speed: ue
                }) : this._call_text_to_waveform(c)
            }
            async _call_supertonic(c, {speaker_embeddings: Y, num_inference_steps: _e, speed: ue}) {
                if (!Y)
                    throw new Error("Speaker embeddings must be provided for Supertonic models.");
                Y = await this._prepare_speaker_embeddings(Y);
                let {sampling_rate: Me, style_dim: re} = this.model.config;
                Y = Y.view(1, -1, re);
                let pe = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                })
                  , {waveform: se} = await this.model.generate_speech({
                    ...pe,
                    style: Y,
                    num_inference_steps: _e,
                    speed: ue
                });
                return new L.RawAudio(se.data,Me)
            }
            async _call_text_to_waveform(c) {
                let Y = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                })
                  , {waveform: _e} = await this.model(Y)
                  , ue = this.model.config.sampling_rate;
                return new L.RawAudio(_e.data,ue)
            }
            async _call_text_to_spectrogram(c, {speaker_embeddings: Y}) {
                this.vocoder || (console.log("No vocoder specified, using default HifiGan vocoder."),
                this.vocoder = await h.AutoModel.from_pretrained(this.DEFAULT_VOCODER_ID, {
                    dtype: "fp32"
                }));
                let {input_ids: _e} = this.tokenizer(c, {
                    padding: !0,
                    truncation: !0
                });
                Y = await this._prepare_speaker_embeddings(Y),
                Y = Y.view(1, -1);
                let {waveform: ue} = await this.model.generate_speech(_e, Y, {
                    vocoder: this.vocoder
                })
                  , Me = this.processor.feature_extractor.config.sampling_rate;
                return new L.RawAudio(ue.data,Me)
            }
        }
        class J extends W {
            constructor(c) {
                super(c)
            }
            async _call(c) {
                let Y = await v(c)
                  , _e = await this.processor(Y)
                  , ue = await this.model(_e)
                  , Me = [];
                for (let re of ue.reconstruction) {
                    let pe = re.squeeze().clamp_(0, 1).mul_(255).round_().to("uint8");
                    Me.push(a.RawImage.fromTensor(pe))
                }
                return Me.length > 1 ? Me : Me[0]
            }
        }
        class ae extends W {
            constructor(c) {
                super(c)
            }
            async _call(c) {
                let Y = await v(c)
                  , _e = await this.processor(Y)
                  , {predicted_depth: ue} = await this.model(_e)
                  , Me = [];
                for (let re = 0; re < Y.length; ++re) {
                    let pe = ue[re]
                      , [se,Te] = pe.dims.slice(-2)
                      , [Ee,ye] = Y[re].size
                      , Pe = (await (0,
                    _.interpolate_4d)(pe.view(1, 1, se, Te), {
                        size: [ye, Ee],
                        mode: "bilinear"
                    })).view(ye, Ee)
                      , Se = Pe.min().item()
                      , De = Pe.max().item()
                      , Ve = Pe.sub(Se).div_(De - Se).mul_(255).to("uint8").unsqueeze(0)
                      , Re = a.RawImage.fromTensor(Ve);
                    Me.push({
                        predicted_depth: Pe,
                        depth: Re
                    })
                }
                return Me.length > 1 ? Me : Me[0]
            }
        }
        let xe = Object.freeze({
            "text-classification": {
                tokenizer: l.AutoTokenizer,
                pipeline: T,
                model: h.AutoModelForSequenceClassification,
                default: {
                    model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
                },
                type: "text"
            },
            "token-classification": {
                tokenizer: l.AutoTokenizer,
                pipeline: k,
                model: h.AutoModelForTokenClassification,
                default: {
                    model: "Xenova/bert-base-multilingual-cased-ner-hrl"
                },
                type: "text"
            },
            "question-answering": {
                tokenizer: l.AutoTokenizer,
                pipeline: I,
                model: h.AutoModelForQuestionAnswering,
                default: {
                    model: "Xenova/distilbert-base-cased-distilled-squad"
                },
                type: "text"
            },
            "fill-mask": {
                tokenizer: l.AutoTokenizer,
                pipeline: p,
                model: h.AutoModelForMaskedLM,
                default: {
                    model: "Xenova/bert-base-uncased"
                },
                type: "text"
            },
            summarization: {
                tokenizer: l.AutoTokenizer,
                pipeline: E,
                model: h.AutoModelForSeq2SeqLM,
                default: {
                    model: "Xenova/distilbart-cnn-6-6"
                },
                type: "text"
            },
            translation: {
                tokenizer: l.AutoTokenizer,
                pipeline: o,
                model: h.AutoModelForSeq2SeqLM,
                default: {
                    model: "Xenova/t5-small"
                },
                type: "text"
            },
            "text2text-generation": {
                tokenizer: l.AutoTokenizer,
                pipeline: m,
                model: h.AutoModelForSeq2SeqLM,
                default: {
                    model: "Xenova/flan-t5-small"
                },
                type: "text"
            },
            "text-generation": {
                tokenizer: l.AutoTokenizer,
                pipeline: x,
                model: h.AutoModelForCausalLM,
                default: {
                    model: "Xenova/gpt2"
                },
                type: "text"
            },
            "zero-shot-classification": {
                tokenizer: l.AutoTokenizer,
                pipeline: S,
                model: h.AutoModelForSequenceClassification,
                default: {
                    model: "Xenova/distilbert-base-uncased-mnli"
                },
                type: "text"
            },
            "audio-classification": {
                pipeline: D,
                model: h.AutoModelForAudioClassification,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/wav2vec2-base-superb-ks"
                },
                type: "audio"
            },
            "zero-shot-audio-classification": {
                tokenizer: l.AutoTokenizer,
                pipeline: $,
                model: h.AutoModel,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/clap-htsat-unfused"
                },
                type: "multimodal"
            },
            "automatic-speech-recognition": {
                tokenizer: l.AutoTokenizer,
                pipeline: U,
                model: [h.AutoModelForSpeechSeq2Seq, h.AutoModelForCTC],
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/whisper-tiny.en"
                },
                type: "multimodal"
            },
            "text-to-audio": {
                tokenizer: l.AutoTokenizer,
                pipeline: V,
                model: [h.AutoModelForTextToWaveform, h.AutoModelForTextToSpectrogram],
                processor: [b.AutoProcessor, null],
                default: {
                    model: "Xenova/speecht5_tts"
                },
                type: "text"
            },
            "image-to-text": {
                tokenizer: l.AutoTokenizer,
                pipeline: H,
                model: h.AutoModelForVision2Seq,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/vit-gpt2-image-captioning"
                },
                type: "multimodal"
            },
            "image-classification": {
                pipeline: Z,
                model: h.AutoModelForImageClassification,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/vit-base-patch16-224"
                },
                type: "multimodal"
            },
            "image-segmentation": {
                pipeline: ee,
                model: [h.AutoModelForImageSegmentation, h.AutoModelForSemanticSegmentation, h.AutoModelForUniversalSegmentation],
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/detr-resnet-50-panoptic"
                },
                type: "multimodal"
            },
            "background-removal": {
                pipeline: le,
                model: [h.AutoModelForImageSegmentation, h.AutoModelForSemanticSegmentation, h.AutoModelForUniversalSegmentation],
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/modnet"
                },
                type: "image"
            },
            "zero-shot-image-classification": {
                tokenizer: l.AutoTokenizer,
                pipeline: we,
                model: h.AutoModel,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/clip-vit-base-patch32"
                },
                type: "multimodal"
            },
            "object-detection": {
                pipeline: ce,
                model: h.AutoModelForObjectDetection,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/detr-resnet-50"
                },
                type: "multimodal"
            },
            "zero-shot-object-detection": {
                tokenizer: l.AutoTokenizer,
                pipeline: Q,
                model: h.AutoModelForZeroShotObjectDetection,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/owlvit-base-patch32"
                },
                type: "multimodal"
            },
            "document-question-answering": {
                tokenizer: l.AutoTokenizer,
                pipeline: A,
                model: h.AutoModelForDocumentQuestionAnswering,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/donut-base-finetuned-docvqa"
                },
                type: "multimodal"
            },
            "image-to-image": {
                pipeline: J,
                model: h.AutoModelForImageToImage,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/swin2SR-classical-sr-x2-64"
                },
                type: "image"
            },
            "depth-estimation": {
                pipeline: ae,
                model: h.AutoModelForDepthEstimation,
                processor: b.AutoProcessor,
                default: {
                    model: "Xenova/dpt-large"
                },
                type: "image"
            },
            "feature-extraction": {
                tokenizer: l.AutoTokenizer,
                pipeline: N,
                model: h.AutoModel,
                default: {
                    model: "Xenova/all-MiniLM-L6-v2"
                },
                type: "text"
            },
            "image-feature-extraction": {
                processor: b.AutoProcessor,
                pipeline: j,
                model: [h.AutoModelForImageFeatureExtraction, h.AutoModel],
                default: {
                    model: "Xenova/vit-base-patch16-224-in21k"
                },
                type: "image"
            }
        })
          , be = Object.freeze({
            "sentiment-analysis": "text-classification",
            ner: "token-classification",
            asr: "automatic-speech-recognition",
            "text-to-speech": "text-to-audio",
            embeddings: "feature-extraction"
        });
        async function Ae(he, c=null, {progress_callback: Y=null, config: _e=null, cache_dir: ue=null, local_files_only: Me=!1, revision: re="main", device: pe=null, dtype: se=null, subfolder: Te="onnx", use_external_data_format: Ee=null, model_file_name: ye=null, session_options: Pe={}}={}) {
            he = be[he] ?? he;
            let Se = xe[he.split("_", 1)[0]];
            if (!Se)
                throw Error(`Unsupported pipeline: ${he}. Must be one of [${Object.keys(xe)}]`);
            c || (c = Se.default.model,
            console.log(`No model specified. Using default model: "${c}".`));
            let De = {
                progress_callback: Y,
                config: _e,
                cache_dir: ue,
                local_files_only: Me,
                revision: re,
                device: pe,
                dtype: se,
                subfolder: Te,
                use_external_data_format: Ee,
                model_file_name: ye,
                session_options: Pe
            }
              , Ve = new Map([["tokenizer", Se.tokenizer], ["model", Se.model], ["processor", Se.processor]])
              , Re = await We(Ve, c, De);
            Re.task = he,
            (0,
            M.dispatchCallback)(Y, {
                status: "ready",
                task: he,
                model: c
            });
            let $e = Se.pipeline;
            return new $e(Re)
        }
        async function We(he, c, Y) {
            let _e = Object.create(null)
              , ue = [];
            for (let[Me,re] of he.entries()) {
                if (!re)
                    continue;
                let pe;
                Array.isArray(re) ? pe = new Promise(async (se, Te) => {
                    let Ee;
                    for (let ye of re) {
                        if (ye === null) {
                            se(null);
                            return
                        }
                        try {
                            se(await ye.from_pretrained(c, Y));
                            return
                        } catch (Pe) {
                            if (Pe.message?.includes("Unsupported model type"))
                                Ee = Pe;
                            else if (Pe.message?.includes("Could not locate file"))
                                Ee = Pe;
                            else {
                                Te(Pe);
                                return
                            }
                        }
                    }
                    Te(Ee)
                }
                ) : pe = re.from_pretrained(c, Y),
                _e[Me] = pe,
                ue.push(pe)
            }
            await Promise.all(ue);
            for (let[Me,re] of Object.entries(_e))
                _e[Me] = await re;
            return _e
        }
    }
    ),
    "./src/tokenizers.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            AlbertTokenizer: () => nt,
            AutoTokenizer: () => or,
            BartTokenizer: () => St,
            BertTokenizer: () => Ls,
            BlenderbotSmallTokenizer: () => Os,
            BlenderbotTokenizer: () => wt,
            BloomTokenizer: () => Jt,
            CLIPTokenizer: () => Yt,
            CamembertTokenizer: () => Ue,
            CodeGenTokenizer: () => Is,
            CodeLlamaTokenizer: () => Ps,
            CohereTokenizer: () => qs,
            ConvBertTokenizer: () => K,
            DebertaTokenizer: () => B,
            DebertaV2Tokenizer: () => w,
            DistilBertTokenizer: () => fe,
            ElectraTokenizer: () => Oe,
            Ernie4_5_Tokenizer: () => er,
            EsmTokenizer: () => os,
            FalconTokenizer: () => ys,
            GPT2Tokenizer: () => ct,
            GPTNeoXTokenizer: () => ws,
            GemmaTokenizer: () => ps,
            Grok1Tokenizer: () => Ds,
            HerbertTokenizer: () => O,
            LlamaTokenizer: () => rs,
            M2M100Tokenizer: () => as,
            MBart50Tokenizer: () => es,
            MBartTokenizer: () => ft,
            MPNetTokenizer: () => hs,
            MarianTokenizer: () => ke,
            MgpstrTokenizer: () => Zs,
            MobileBertTokenizer: () => As,
            NllbTokenizer: () => xs,
            NougatTokenizer: () => ns,
            PreTrainedTokenizer: () => Ye,
            Qwen2Tokenizer: () => us,
            RoFormerTokenizer: () => ie,
            RobertaTokenizer: () => ss,
            SiglipTokenizer: () => Fe,
            SpeechT5Tokenizer: () => Es,
            SqueezeBertTokenizer: () => n,
            T5Tokenizer: () => lt,
            TokenizerModel: () => N,
            VitsTokenizer: () => Ys,
            Wav2Vec2CTCTokenizer: () => Ke,
            WhisperTokenizer: () => vs,
            XLMRobertaTokenizer: () => Ts,
            XLMTokenizer: () => Qe,
            is_chinese_char: () => I
        });
        var l = e("./src/utils/generic.js")
          , h = e("./src/utils/core.js")
          , b = e("./src/utils/hub.js")
          , R = e("./src/utils/maths.js")
          , C = e("./src/utils/tensor.js")
          , M = e("./src/utils/data-structures.js")
          , f = e("./node_modules/@huggingface/jinja/dist/index.js")
          , L = e("./src/models/whisper/common_whisper.js");
        async function _(q, i) {
            let F = await Promise.all([(0,
            b.getModelJSON)(q, "tokenizer.json", !0, i), (0,
            b.getModelJSON)(q, "tokenizer_config.json", !0, i)]);
            return i.legacy !== null && (F[1].legacy = i.legacy),
            F
        }
        function a(q, i) {
            let F = []
              , z = 0;
            for (let G of q.matchAll(i)) {
                let ne = G[0];
                z < G.index && F.push(q.slice(z, G.index)),
                ne.length > 0 && F.push(ne),
                z = G.index + ne.length
            }
            return z < q.length && F.push(q.slice(z)),
            F
        }
        function v(q, i=!0) {
            if (q.Regex !== void 0) {
                let F = q.Regex.replace(/\\([#&~])/g, "$1");
                for (let[z,G] of x)
                    F = F.replaceAll(z, G);
                return new RegExp(F,"gu")
            } else if (q.String !== void 0) {
                let F = (0,
                h.escapeRegExp)(q.String);
                return new RegExp(i ? F : `(${F})`,"gu")
            } else
                return console.warn("Unknown pattern type:", q),
                null
        }
        function g(q) {
            return new Map(Object.entries(q))
        }
        function y(q) {
            let i = q.dims;
            switch (i.length) {
            case 1:
                return q.tolist();
            case 2:
                if (i[0] !== 1)
                    throw new Error("Unable to decode tensor with `batch size !== 1`. Use `tokenizer.batch_decode(...)` for batched inputs.");
                return q.tolist()[0];
            default:
                throw new Error(`Expected tensor to have 1-2 dimensions, got ${i.length}.`)
            }
        }
        function W(q) {
            return q.replace(/ \./g, ".").replace(/ \?/g, "?").replace(/ \!/g, "!").replace(/ ,/g, ",").replace(/ \' /g, "'").replace(/ n\'t/g, "n't").replace(/ \'m/g, "'m").replace(/ \'s/g, "'s").replace(/ \'ve/g, "'ve").replace(/ \'re/g, "'re")
        }
        function T(q) {
            return q.replace(/\p{M}/gu, "")
        }
        function k(q) {
            return T(q.toLowerCase())
        }
        function I(q) {
            return q >= 19968 && q <= 40959 || q >= 13312 && q <= 19903 || q >= 131072 && q <= 173791 || q >= 173824 && q <= 177983 || q >= 177984 && q <= 178207 || q >= 178208 && q <= 183983 || q >= 63744 && q <= 64255 || q >= 194560 && q <= 195103
        }
        function p(q, i, F) {
            let z = []
              , G = 0;
            for (; G < q.length; ) {
                if (z.push(q[G]),
                (i.get(q[G]) ?? F) !== F) {
                    ++G;
                    continue
                }
                for (; ++G < q.length && (i.get(q[G]) ?? F) === F; )
                    i.get(z.at(-1)) !== F && (z[z.length - 1] += q[G])
            }
            return z
        }
        function m(q) {
            return q.match(/\S+/g) || []
        }
        let E = "\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E"
          , o = new RegExp(`^[${E}]+$`,"gu")
          , d = ".,!?\u2026\u3002\uFF0C\u3001\u0964\u06D4\u060C"
          , x = new Map([["(?i:'s|'t|'re|'ve|'m|'ll|'d)", "(?:'([sS]|[tT]|[rR][eE]|[vV][eE]|[mM]|[lL][lL]|[dD]))"], ["(?i:[sdmt]|ll|ve|re)", "(?:[sS]|[dD]|[mM]|[tT]|[lL][lL]|[vV][eE]|[rR][eE])"], ["[^\\r\\n\\p{L}\\p{N}]?+", "[^\\r\\n\\p{L}\\p{N}]?"], ["[^\\s\\p{L}\\p{N}]++", "[^\\s\\p{L}\\p{N}]+"], [` ?[^(\\s|[${d}])]+`, ` ?[^\\s${d}]+`]]);
        class S {
            constructor(i) {
                this.content = i.content,
                this.id = i.id,
                this.single_word = i.single_word ?? !1,
                this.lstrip = i.lstrip ?? !1,
                this.rstrip = i.rstrip ?? !1,
                this.special = i.special ?? !1,
                this.normalized = i.normalized ?? null
            }
        }
        class N extends l.Callable {
            constructor(i) {
                super(),
                this.config = i,
                this.vocab = [],
                this.tokens_to_ids = new Map,
                this.unk_token_id = void 0,
                this.unk_token = void 0,
                this.end_of_word_suffix = void 0,
                this.fuse_unk = this.config.fuse_unk ?? !1
            }
            static fromConfig(i, ...F) {
                switch (i.type) {
                case "WordPiece":
                    return new j(i);
                case "Unigram":
                    return new D(i,...F);
                case "BPE":
                    return new H(i);
                default:
                    if (i.vocab)
                        return Array.isArray(i.vocab) ? new D(i,...F) : Object.hasOwn(i, "continuing_subword_prefix") && Object.hasOwn(i, "unk_token") ? Object.hasOwn(i, "merges") ? new H(i) : new j(i) : new Z(i,...F);
                    throw new Error(`Unknown TokenizerModel type: ${i.type}`)
                }
            }
            _call(i) {
                return i = this.encode(i),
                this.fuse_unk && (i = p(i, this.tokens_to_ids, this.unk_token_id)),
                i
            }
            encode(i) {
                throw Error("encode should be implemented in subclass.")
            }
            convert_tokens_to_ids(i) {
                return i.map(F => this.tokens_to_ids.get(F) ?? this.unk_token_id)
            }
            convert_ids_to_tokens(i) {
                return i.map(F => this.vocab[F] ?? this.unk_token)
            }
        }
        class j extends N {
            constructor(i) {
                super(i),
                this.tokens_to_ids = g(i.vocab),
                this.unk_token_id = this.tokens_to_ids.get(i.unk_token),
                this.unk_token = i.unk_token,
                this.max_input_chars_per_word = i.max_input_chars_per_word ?? 100,
                this.vocab = new Array(this.tokens_to_ids.size);
                for (let[F,z] of this.tokens_to_ids)
                    this.vocab[z] = F
            }
            encode(i) {
                let F = [];
                for (let z of i) {
                    let G = [...z];
                    if (G.length > this.max_input_chars_per_word) {
                        F.push(this.unk_token);
                        continue
                    }
                    let ne = !1
                      , ge = 0
                      , Be = [];
                    for (; ge < G.length; ) {
                        let je = G.length
                          , Ne = null;
                        for (; ge < je; ) {
                            let Le = G.slice(ge, je).join("");
                            if (ge > 0 && (Le = this.config.continuing_subword_prefix + Le),
                            this.tokens_to_ids.has(Le)) {
                                Ne = Le;
                                break
                            }
                            --je
                        }
                        if (Ne === null) {
                            ne = !0;
                            break
                        }
                        Be.push(Ne),
                        ge = je
                    }
                    ne ? F.push(this.unk_token) : F.push(...Be)
                }
                return F
            }
        }
        class D extends N {
            constructor(i, F) {
                super(i);
                let z = i.vocab.length;
                this.vocab = new Array(z),
                this.scores = new Array(z);
                for (let G = 0; G < z; ++G)
                    [this.vocab[G],this.scores[G]] = i.vocab[G];
                this.unk_token_id = i.unk_id,
                this.unk_token = this.vocab[i.unk_id],
                this.tokens_to_ids = new Map(this.vocab.map( (G, ne) => [G, ne])),
                this.bos_token = " ",
                this.bos_token_id = this.tokens_to_ids.get(this.bos_token),
                this.eos_token = F.eos_token,
                this.eos_token_id = this.tokens_to_ids.get(this.eos_token),
                this.unk_token = this.vocab[this.unk_token_id],
                this.minScore = (0,
                R.min)(this.scores)[0],
                this.unk_score = this.minScore - 10,
                this.scores[this.unk_token_id] = this.unk_score,
                this.trie = new M.CharTrie,
                this.trie.extend(this.vocab),
                this.fuse_unk = !0
            }
            populateNodes(i) {
                let F = i.chars
                  , z = 1
                  , G = 0;
                for (; G < F.length; ) {
                    let ne = !1
                      , ge = []
                      , Be = F.slice(G).join("")
                      , je = this.trie.commonPrefixSearch(Be);
                    for (let Ne of je) {
                        ge.push(Ne);
                        let Le = this.tokens_to_ids.get(Ne)
                          , _t = this.scores[Le]
                          , ot = (0,
                        h.len)(Ne);
                        i.insert(G, ot, _t, Le),
                        !ne && ot === z && (ne = !0)
                    }
                    ne || i.insert(G, z, this.unk_score, this.unk_token_id),
                    G += z
                }
            }
            tokenize(i) {
                let F = new M.TokenLattice(i,this.bos_token_id,this.eos_token_id);
                return this.populateNodes(F),
                F.tokens()
            }
            encode(i) {
                let F = [];
                for (let z of i) {
                    let G = this.tokenize(z);
                    F.push(...G)
                }
                return F
            }
        }
        let $ = ( () => {
            let q = [...Array.from({
                length: 94
            }, (G, ne) => ne + 33), ...Array.from({
                length: 12
            }, (G, ne) => ne + 161), ...Array.from({
                length: 82
            }, (G, ne) => ne + 174)]
              , i = q.slice()
              , F = 0;
            for (let G = 0; G < 256; ++G)
                q.includes(G) || (q.push(G),
                i.push(256 + F),
                F += 1);
            let z = i.map(G => String.fromCharCode(G));
            return Object.fromEntries(q.map( (G, ne) => [G, z[ne]]))
        }
        )()
          , U = (0,
        h.reverseDictionary)($);
        class H extends N {
            constructor(i) {
                super(i),
                this.tokens_to_ids = g(i.vocab),
                this.unk_token_id = this.tokens_to_ids.get(i.unk_token),
                this.unk_token = i.unk_token,
                this.vocab = new Array(this.tokens_to_ids.size);
                for (let[z,G] of this.tokens_to_ids)
                    this.vocab[G] = z;
                let F = Array.isArray(i.merges[0]);
                this.merges = F ? i.merges : i.merges.map(z => z.split(" ", 2)),
                this.bpe_ranks = new Map(this.merges.map( (z, G) => [JSON.stringify(z), G])),
                this.end_of_word_suffix = i.end_of_word_suffix,
                this.continuing_subword_suffix = i.continuing_subword_suffix ?? null,
                this.byte_fallback = this.config.byte_fallback ?? !1,
                this.byte_fallback && (this.text_encoder = new TextEncoder),
                this.ignore_merges = this.config.ignore_merges ?? !1,
                this.max_length_to_cache = 256,
                this.cache_capacity = 1e4,
                this.cache = new M.LRUCache(this.cache_capacity)
            }
            clear_cache() {
                this.cache.clear()
            }
            bpe(i) {
                if (i.length === 0)
                    return [];
                let F = this.cache.get(i);
                if (F !== void 0)
                    return F;
                let z = Array.from(i);
                this.end_of_word_suffix && (z[z.length - 1] += this.end_of_word_suffix);
                let G = [];
                if (z.length > 1) {
                    let ne = new M.PriorityQueue( (je, Ne) => je.score < Ne.score)
                      , ge = {
                        token: z[0],
                        bias: 0,
                        prev: null,
                        next: null
                    }
                      , Be = ge;
                    for (let je = 1; je < z.length; ++je) {
                        let Ne = {
                            bias: je / z.length,
                            token: z[je],
                            prev: Be,
                            next: null
                        };
                        Be.next = Ne,
                        this._add_node(ne, Be),
                        Be = Ne
                    }
                    for (; !ne.isEmpty(); ) {
                        let je = ne.pop();
                        if (je.deleted || !je.next || je.next.deleted)
                            continue;
                        if (je.deleted = !0,
                        je.next.deleted = !0,
                        je.prev) {
                            let Le = {
                                ...je.prev
                            };
                            je.prev.deleted = !0,
                            je.prev = Le,
                            Le.prev ? Le.prev.next = Le : ge = Le
                        }
                        let Ne = {
                            token: je.token + je.next.token,
                            bias: je.bias,
                            prev: je.prev,
                            next: je.next.next
                        };
                        Ne.prev ? (Ne.prev.next = Ne,
                        this._add_node(ne, Ne.prev)) : ge = Ne,
                        Ne.next && (Ne.next.prev = Ne,
                        this._add_node(ne, Ne))
                    }
                    for (let je = ge; je !== null; je = je.next)
                        G.push(je.token)
                } else
                    G = z;
                if (this.continuing_subword_suffix)
                    for (let ne = 0; ne < G.length - 1; ++ne)
                        G[ne] += this.continuing_subword_suffix;
                return i.length < this.max_length_to_cache && this.cache.put(i, G),
                G
            }
            _add_node(i, F) {
                let z = this.bpe_ranks.get(JSON.stringify([F.token, F.next.token]));
                z !== void 0 && (F.score = z + F.bias,
                i.push(F))
            }
            encode(i) {
                let F = [];
                for (let z of i) {
                    if (this.ignore_merges && this.tokens_to_ids.has(z)) {
                        F.push(z);
                        continue
                    }
                    let G = this.bpe(z);
                    for (let ne of G)
                        if (this.tokens_to_ids.has(ne))
                            F.push(ne);
                        else if (this.byte_fallback) {
                            let ge = Array.from(this.text_encoder.encode(ne)).map(Be => `<0x${Be.toString(16).toUpperCase().padStart(2, "0")}>`);
                            ge.every(Be => this.tokens_to_ids.has(Be)) ? F.push(...ge) : F.push(this.unk_token)
                        } else
                            F.push(this.unk_token)
                }
                return F
            }
        }
        class Z extends N {
            constructor(i, F) {
                super(i),
                this.tokens_to_ids = g(F.target_lang ? i.vocab[F.target_lang] : i.vocab),
                this.bos_token = F.bos_token,
                this.bos_token_id = this.tokens_to_ids.get(this.bos_token),
                this.eos_token = F.eos_token,
                this.eos_token_id = this.tokens_to_ids.get(this.eos_token),
                this.pad_token = F.pad_token,
                this.pad_token_id = this.tokens_to_ids.get(this.pad_token),
                this.unk_token = F.unk_token,
                this.unk_token_id = this.tokens_to_ids.get(this.unk_token),
                this.vocab = new Array(this.tokens_to_ids.size);
                for (let[z,G] of this.tokens_to_ids)
                    this.vocab[G] = z
            }
            encode(i) {
                return i
            }
        }
        class ee extends l.Callable {
            constructor(i) {
                super(),
                this.config = i
            }
            static fromConfig(i) {
                if (i === null)
                    return null;
                switch (i.type) {
                case "BertNormalizer":
                    return new We(i);
                case "Precompiled":
                    return new Zt(i);
                case "Sequence":
                    return new Ae(i);
                case "Replace":
                    return new le(i);
                case "NFC":
                    return new ce(i);
                case "NFD":
                    return new Q(i);
                case "NFKC":
                    return new A(i);
                case "NFKD":
                    return new V(i);
                case "Strip":
                    return new J(i);
                case "StripAccents":
                    return new ae(i);
                case "Lowercase":
                    return new xe(i);
                case "Prepend":
                    return new be(i);
                default:
                    throw new Error(`Unknown Normalizer type: ${i.type}`)
                }
            }
            normalize(i) {
                throw Error("normalize should be implemented in subclass.")
            }
            _call(i) {
                return this.normalize(i)
            }
        }
        class le extends ee {
            normalize(i) {
                let F = v(this.config.pattern);
                return F === null ? i : i.replaceAll(F, this.config.content)
            }
        }
        class we extends ee {
            form = void 0;
            normalize(i) {
                return i = i.normalize(this.form),
                i
            }
        }
        class ce extends we {
            form = "NFC"
        }
        class Q extends we {
            form = "NFD"
        }
        class A extends we {
            form = "NFKC"
        }
        class V extends we {
            form = "NFKD"
        }
        class J extends ee {
            normalize(i) {
                return this.config.strip_left && this.config.strip_right ? i = i.trim() : (this.config.strip_left && (i = i.trimStart()),
                this.config.strip_right && (i = i.trimEnd())),
                i
            }
        }
        class ae extends ee {
            normalize(i) {
                return i = T(i),
                i
            }
        }
        class xe extends ee {
            normalize(i) {
                return i = i.toLowerCase(),
                i
            }
        }
        class be extends ee {
            normalize(i) {
                return i = this.config.prepend + i,
                i
            }
        }
        class Ae extends ee {
            constructor(i) {
                super(i),
                this.normalizers = i.normalizers.map(F => ee.fromConfig(F))
            }
            normalize(i) {
                return this.normalizers.reduce( (F, z) => z.normalize(F), i)
            }
        }
        class We extends ee {
            _tokenize_chinese_chars(i) {
                let F = [];
                for (let z = 0; z < i.length; ++z) {
                    let G = i[z]
                      , ne = G.charCodeAt(0);
                    I(ne) ? (F.push(" "),
                    F.push(G),
                    F.push(" ")) : F.push(G)
                }
                return F.join("")
            }
            stripAccents(i) {
                return i.normalize("NFD").replace(/\p{Mn}/gu, "")
            }
            _is_control(i) {
                switch (i) {
                case "	":
                case `
`:
                case "\r":
                    return !1;
                default:
                    return /^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u.test(i)
                }
            }
            _clean_text(i) {
                let F = [];
                for (let z of i) {
                    let G = z.charCodeAt(0);
                    G === 0 || G === 65533 || this._is_control(z) || (/^\s$/.test(z) ? F.push(" ") : F.push(z))
                }
                return F.join("")
            }
            normalize(i) {
                return this.config.clean_text && (i = this._clean_text(i)),
                this.config.handle_chinese_chars && (i = this._tokenize_chinese_chars(i)),
                this.config.lowercase ? (i = i.toLowerCase(),
                this.config.strip_accents !== !1 && (i = this.stripAccents(i))) : this.config.strip_accents && (i = this.stripAccents(i)),
                i
            }
        }
        class he extends l.Callable {
            static fromConfig(i) {
                if (i === null)
                    return null;
                switch (i.type) {
                case "BertPreTokenizer":
                    return new c(i);
                case "Sequence":
                    return new Gt(i);
                case "Whitespace":
                    return new Ft(i);
                case "WhitespaceSplit":
                    return new $t(i);
                case "Metaspace":
                    return new ht(i);
                case "ByteLevel":
                    return new Y(i);
                case "Split":
                    return new _e(i);
                case "Punctuation":
                    return new ue(i);
                case "Digits":
                    return new Me(i);
                case "Replace":
                    return new Rs(i);
                case "FixedLength":
                    return new zs(i);
                default:
                    throw new Error(`Unknown PreTokenizer type: ${i.type}`)
                }
            }
            pre_tokenize_text(i, F) {
                throw Error("pre_tokenize_text should be implemented in subclass.")
            }
            pre_tokenize(i, F) {
                return (Array.isArray(i) ? i.map(z => this.pre_tokenize_text(z, F)) : this.pre_tokenize_text(i, F)).flat()
            }
            _call(i, F) {
                return this.pre_tokenize(i, F)
            }
        }
        class c extends he {
            constructor(i) {
                super(),
                this.pattern = new RegExp(`[^\\s${E}]+|[${E}]`,"gu")
            }
            pre_tokenize_text(i, F) {
                return i.trim().match(this.pattern) || []
            }
        }
        class Y extends he {
            constructor(i) {
                super(),
                this.config = i,
                this.add_prefix_space = this.config.add_prefix_space,
                this.trim_offsets = this.config.trim_offsets,
                this.use_regex = this.config.use_regex ?? !0,
                this.pattern = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu,
                this.byte_encoder = $,
                this.text_encoder = new TextEncoder
            }
            pre_tokenize_text(i, F) {
                return this.add_prefix_space && !i.startsWith(" ") && (i = " " + i),
                (this.use_regex ? i.match(this.pattern) || [] : [i]).map(G => Array.from(this.text_encoder.encode(G), ne => this.byte_encoder[ne]).join(""))
            }
        }
        class _e extends he {
            constructor(i) {
                super(),
                this.config = i,
                this.pattern = v(this.config.pattern, this.config.invert)
            }
            pre_tokenize_text(i, F) {
                return this.pattern === null ? [] : this.config.invert ? i.match(this.pattern) || [] : this.config.behavior?.toLowerCase() === "removed" ? i.split(this.pattern).filter(z => z) : a(i, this.pattern)
            }
        }
        class ue extends he {
            constructor(i) {
                super(),
                this.config = i,
                this.pattern = new RegExp(`[^${E}]+|[${E}]+`,"gu")
            }
            pre_tokenize_text(i, F) {
                return i.match(this.pattern) || []
            }
        }
        class Me extends he {
            constructor(i) {
                super(),
                this.config = i;
                let F = `[^\\d]+|\\d${this.config.individual_digits ? "" : "+"}`;
                this.pattern = new RegExp(F,"gu")
            }
            pre_tokenize_text(i, F) {
                return i.match(this.pattern) || []
            }
        }
        class re extends l.Callable {
            constructor(i) {
                super(),
                this.config = i
            }
            static fromConfig(i) {
                if (i === null)
                    return null;
                switch (i.type) {
                case "TemplateProcessing":
                    return new Te(i);
                case "ByteLevel":
                    return new Ee(i);
                case "RobertaProcessing":
                    return new se(i);
                case "BertProcessing":
                    return new pe(i);
                case "Sequence":
                    return new ye(i);
                default:
                    throw new Error(`Unknown PostProcessor type: ${i.type}`)
                }
            }
            post_process(i, ...F) {
                throw Error("post_process should be implemented in subclass.")
            }
            _call(i, ...F) {
                return this.post_process(i, ...F)
            }
        }
        class pe extends re {
            constructor(i) {
                super(i),
                this.cls = i.cls[0],
                this.sep = i.sep[0]
            }
            post_process(i, F=null, {add_special_tokens: z=!0}={}) {
                z && (i = (0,
                h.mergeArrays)([this.cls], i, [this.sep]));
                let G = new Array(i.length).fill(0);
                if (F !== null) {
                    let ne = z && this instanceof se ? [this.sep] : []
                      , ge = z ? [this.sep] : [];
                    i = (0,
                    h.mergeArrays)(i, ne, F, ge),
                    G = (0,
                    h.mergeArrays)(G, new Array(F.length + ne.length + ge.length).fill(1))
                }
                return {
                    tokens: i,
                    token_type_ids: G
                }
            }
        }
        class se extends pe {
        }
        class Te extends re {
            constructor(i) {
                super(i),
                this.single = i.single,
                this.pair = i.pair
            }
            post_process(i, F=null, {add_special_tokens: z=!0}={}) {
                let G = F === null ? this.single : this.pair
                  , ne = []
                  , ge = [];
                for (let Be of G)
                    "SpecialToken"in Be ? z && (ne.push(Be.SpecialToken.id),
                    ge.push(Be.SpecialToken.type_id)) : "Sequence"in Be && (Be.Sequence.id === "A" ? (ne = (0,
                    h.mergeArrays)(ne, i),
                    ge = (0,
                    h.mergeArrays)(ge, new Array(i.length).fill(Be.Sequence.type_id))) : Be.Sequence.id === "B" && (ne = (0,
                    h.mergeArrays)(ne, F),
                    ge = (0,
                    h.mergeArrays)(ge, new Array(F.length).fill(Be.Sequence.type_id))));
                return {
                    tokens: ne,
                    token_type_ids: ge
                }
            }
        }
        class Ee extends re {
            post_process(i, F=null) {
                return F && (i = (0,
                h.mergeArrays)(i, F)),
                {
                    tokens: i
                }
            }
        }
        class ye extends re {
            constructor(i) {
                super(i),
                this.processors = i.processors.map(F => re.fromConfig(F))
            }
            post_process(i, F=null, z={}) {
                let G;
                for (let ne of this.processors)
                    if (ne instanceof Ee)
                        i = ne.post_process(i).tokens,
                        F && (F = ne.post_process(F).tokens);
                    else {
                        let ge = ne.post_process(i, F, z);
                        i = ge.tokens,
                        G = ge.token_type_ids
                    }
                return {
                    tokens: i,
                    token_type_ids: G
                }
            }
        }
        class Pe extends l.Callable {
            constructor(i) {
                super(),
                this.config = i,
                this.added_tokens = [],
                this.end_of_word_suffix = null,
                this.trim_offsets = i.trim_offsets
            }
            static fromConfig(i) {
                if (i === null)
                    return null;
                switch (i.type) {
                case "WordPiece":
                    return new $e(i);
                case "Metaspace":
                    return new Kt(i);
                case "ByteLevel":
                    return new ze(i);
                case "Replace":
                    return new Se(i);
                case "ByteFallback":
                    return new De(i);
                case "Fuse":
                    return new Ve(i);
                case "Strip":
                    return new Re(i);
                case "Sequence":
                    return new Ie(i);
                case "CTC":
                    return new Ze(i);
                case "BPEDecoder":
                    return new st(i);
                default:
                    throw new Error(`Unknown Decoder type: ${i.type}`)
                }
            }
            _call(i) {
                return this.decode(i)
            }
            decode(i) {
                return this.decode_chain(i).join("")
            }
            decode_chain(i) {
                throw Error("`decode_chain` should be implemented in subclass.")
            }
        }
        class Se extends Pe {
            decode_chain(i) {
                let F = v(this.config.pattern);
                return F === null ? i : i.map(z => z.replaceAll(F, this.config.content))
            }
        }
        class De extends Pe {
            constructor(i) {
                super(i),
                this.text_decoder = new TextDecoder
            }
            decode_chain(i) {
                let F = []
                  , z = [];
                for (let G of i) {
                    let ne = null;
                    if (G.length === 6 && G.startsWith("<0x") && G.endsWith(">")) {
                        let ge = parseInt(G.slice(3, 5), 16);
                        isNaN(ge) || (ne = ge)
                    }
                    if (ne !== null)
                        z.push(ne);
                    else {
                        if (z.length > 0) {
                            let ge = this.text_decoder.decode(Uint8Array.from(z));
                            F.push(ge),
                            z = []
                        }
                        F.push(G)
                    }
                }
                if (z.length > 0) {
                    let G = this.text_decoder.decode(Uint8Array.from(z));
                    F.push(G),
                    z = []
                }
                return F
            }
        }
        class Ve extends Pe {
            decode_chain(i) {
                return [i.join("")]
            }
        }
        class Re extends Pe {
            constructor(i) {
                super(i),
                this.content = this.config.content,
                this.start = this.config.start,
                this.stop = this.config.stop
            }
            decode_chain(i) {
                return i.map(F => {
                    let z = 0;
                    for (let ne = 0; ne < this.start && F[ne] === this.content; ++ne) {
                        z = ne + 1;
                        continue
                    }
                    let G = F.length;
                    for (let ne = 0; ne < this.stop; ++ne) {
                        let ge = F.length - ne - 1;
                        if (F[ge] === this.content) {
                            G = ge;
                            continue
                        } else
                            break
                    }
                    return F.slice(z, G)
                }
                )
            }
        }
        class $e extends Pe {
            constructor(i) {
                super(i),
                this.cleanup = i.cleanup
            }
            decode_chain(i) {
                return i.map( (F, z) => (z !== 0 && (F.startsWith(this.config.prefix) ? F = F.replace(this.config.prefix, "") : F = " " + F),
                this.cleanup && (F = W(F)),
                F))
            }
        }
        class ze extends Pe {
            constructor(i) {
                super(i),
                this.byte_decoder = U,
                this.text_decoder = new TextDecoder("utf-8",{
                    fatal: !1,
                    ignoreBOM: !0
                }),
                this.end_of_word_suffix = null
            }
            convert_tokens_to_string(i) {
                let F = i.join("")
                  , z = new Uint8Array([...F].map(ne => this.byte_decoder[ne]));
                return this.text_decoder.decode(z)
            }
            decode_chain(i) {
                let F = []
                  , z = [];
                for (let G of i)
                    this.added_tokens.find(ne => ne.content === G) !== void 0 ? (z.length > 0 && (F.push(this.convert_tokens_to_string(z)),
                    z = []),
                    F.push(G)) : z.push(G);
                return z.length > 0 && F.push(this.convert_tokens_to_string(z)),
                F
            }
        }
        class Ze extends Pe {
            constructor(i) {
                super(i),
                this.pad_token = this.config.pad_token,
                this.word_delimiter_token = this.config.word_delimiter_token,
                this.cleanup = this.config.cleanup
            }
            convert_tokens_to_string(i) {
                if (i.length === 0)
                    return "";
                let F = [i[0]];
                for (let ne = 1; ne < i.length; ++ne)
                    i[ne] !== F.at(-1) && F.push(i[ne]);
                let G = F.filter(ne => ne !== this.pad_token).join("");
                return this.cleanup && (G = W(G).replaceAll(this.word_delimiter_token, " ").trim()),
                G
            }
            decode_chain(i) {
                return [this.convert_tokens_to_string(i)]
            }
        }
        class Ie extends Pe {
            constructor(i) {
                super(i),
                this.decoders = i.decoders.map(F => Pe.fromConfig(F))
            }
            decode_chain(i) {
                return this.decoders.reduce( (F, z) => z.decode_chain(F), i)
            }
        }
        class st extends Pe {
            constructor(i) {
                super(i),
                this.suffix = this.config.suffix
            }
            decode_chain(i) {
                return i.map( (F, z) => F.replaceAll(this.suffix, z === i.length - 1 ? "" : " "))
            }
        }
        class qe extends Pe {
            decode_chain(i) {
                let F = "";
                for (let z = 1; z < i.length; z += 2)
                    F += i[z];
                return [F]
            }
        }
        class ht extends he {
            constructor(i) {
                super(),
                this.replacement = i.replacement,
                this.strRep = i.str_rep || this.replacement,
                this.prepend_scheme = i.prepend_scheme ?? "always"
            }
            pre_tokenize_text(i, {section_index: F=void 0}={}) {
                let z = i.replaceAll(" ", this.strRep);
                return !z.startsWith(this.replacement) && (this.prepend_scheme === "always" || this.prepend_scheme === "first" && F === 0) && (z = this.strRep + z),
                [z]
            }
        }
        class Kt extends Pe {
            constructor(i) {
                super(i),
                this.replacement = i.replacement
            }
            decode_chain(i) {
                let F = [];
                for (let z = 0; z < i.length; ++z) {
                    let G = i[z].replaceAll(this.replacement, " ");
                    z == 0 && G.startsWith(" ") && (G = G.substring(1)),
                    F.push(G)
                }
                return F
            }
        }
        class Zt extends ee {
            constructor(i) {
                super(i),
                this.charsmap = i.precompiled_charsmap
            }
            normalize(i) {
                return i = i.replace(/[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm, ""),
                i = i.replace(/[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm, " "),
                i.includes("\uFF5E") ? i = i.split("\uFF5E").map(z => z.normalize("NFKC")).join("\uFF5E") : i = i.normalize("NFKC"),
                i
            }
        }
        class Gt extends he {
            constructor(i) {
                super(),
                this.tokenizers = i.pretokenizers.map(F => he.fromConfig(F))
            }
            pre_tokenize_text(i, F) {
                return this.tokenizers.reduce( (z, G) => G.pre_tokenize(z, F), [i])
            }
        }
        class Ft extends he {
            constructor(i) {
                super()
            }
            pre_tokenize_text(i, F) {
                return i.match(/\w+|[^\w\s]+/g) || []
            }
        }
        class $t extends he {
            constructor(i) {
                super()
            }
            pre_tokenize_text(i, F) {
                return m(i)
            }
        }
        class Rs extends he {
            constructor(i) {
                super(),
                this.config = i,
                this.pattern = v(this.config.pattern),
                this.content = this.config.content
            }
            pre_tokenize_text(i, F) {
                return this.pattern === null ? [i] : [i.replaceAll(this.pattern, this.config.content)]
            }
        }
        class zs extends he {
            constructor(i) {
                super(),
                this._length = i.length
            }
            pre_tokenize_text(i, F) {
                let z = [];
                for (let G = 0; G < i.length; G += this._length)
                    z.push(i.slice(G, G + this._length));
                return z
            }
        }
        let Gs = ["bos_token", "eos_token", "unk_token", "sep_token", "pad_token", "cls_token", "mask_token"];
        function ds(q, i, F, z) {
            for (let G of Object.keys(q)) {
                let ne = i - q[G].length
                  , ge = F(G)
                  , Be = new Array(ne).fill(ge);
                q[G] = z === "right" ? (0,
                h.mergeArrays)(q[G], Be) : (0,
                h.mergeArrays)(Be, q[G])
            }
        }
        function Ws(q, i) {
            for (let F of Object.keys(q))
                q[F].length = i
        }
        class Ye extends l.Callable {
            return_token_type_ids = !1;
            padding_side = "right";
            constructor(i, F) {
                super(),
                this.config = F,
                this.normalizer = ee.fromConfig(i.normalizer),
                this.pre_tokenizer = he.fromConfig(i.pre_tokenizer),
                this.model = N.fromConfig(i.model, F),
                this.post_processor = re.fromConfig(i.post_processor),
                this.decoder = Pe.fromConfig(i.decoder),
                this.special_tokens = [],
                this.all_special_ids = [],
                this.added_tokens = [];
                for (let z of i.added_tokens) {
                    let G = new S(z);
                    this.added_tokens.push(G),
                    this.model.tokens_to_ids.set(G.content, G.id),
                    this.model.vocab[G.id] = G.content,
                    G.special && (this.special_tokens.push(G.content),
                    this.all_special_ids.push(G.id))
                }
                if (this.additional_special_tokens = F.additional_special_tokens ?? [],
                this.special_tokens.push(...this.additional_special_tokens),
                this.special_tokens = [...new Set(this.special_tokens)],
                this.decoder && (this.decoder.added_tokens = this.added_tokens,
                this.decoder.end_of_word_suffix = this.model.end_of_word_suffix),
                this.added_tokens_splitter = new M.DictionarySplitter(this.added_tokens.map(z => z.content)),
                this.added_tokens_map = new Map(this.added_tokens.map(z => [z.content, z])),
                this.mask_token = this.getToken("mask_token"),
                this.mask_token_id = this.model.tokens_to_ids.get(this.mask_token),
                this.pad_token = this.getToken("pad_token", "eos_token"),
                this.pad_token_id = this.model.tokens_to_ids.get(this.pad_token),
                this.sep_token = this.getToken("sep_token"),
                this.sep_token_id = this.model.tokens_to_ids.get(this.sep_token),
                this.unk_token = this.getToken("unk_token"),
                this.unk_token_id = this.model.tokens_to_ids.get(this.unk_token),
                this.bos_token = this.getToken("bos_token"),
                this.bos_token_id = this.model.tokens_to_ids.get(this.bos_token),
                this.eos_token = this.getToken("eos_token"),
                this.eos_token_id = this.model.tokens_to_ids.get(this.eos_token),
                this.model_max_length = F.model_max_length,
                this.remove_space = F.remove_space,
                this.clean_up_tokenization_spaces = F.clean_up_tokenization_spaces ?? !0,
                this.do_lowercase_and_remove_accent = F.do_lowercase_and_remove_accent ?? !1,
                F.padding_side && (this.padding_side = F.padding_side),
                this.add_bos_token = F.add_bos_token,
                this.add_eos_token = F.add_eos_token,
                this.legacy = !1,
                this.chat_template = F.chat_template ?? null,
                Array.isArray(this.chat_template)) {
                    let z = Object.create(null);
                    for (let {name: G, template: ne} of this.chat_template) {
                        if (typeof G != "string" || typeof ne != "string")
                            throw new Error('Chat template must be a list of objects with "name" and "template" properties');
                        z[G] = ne
                    }
                    this.chat_template = z
                }
                this._compiled_template_cache = new Map
            }
            getToken(...i) {
                for (let F of i) {
                    let z = this.config[F];
                    if (z)
                        if (typeof z == "object") {
                            if (z.__type === "AddedToken")
                                return z.content;
                            throw Error(`Unknown token: ${z}`)
                        } else
                            return z
                }
                return null
            }
            static async from_pretrained(i, {progress_callback: F=null, config: z=null, cache_dir: G=null, local_files_only: ne=!1, revision: ge="main", legacy: Be=null}={}) {
                let je = await _(i, {
                    progress_callback: F,
                    config: z,
                    cache_dir: G,
                    local_files_only: ne,
                    revision: ge,
                    legacy: Be
                });
                return new this(...je)
            }
            _call(i, {text_pair: F=null, add_special_tokens: z=!0, padding: G=!1, truncation: ne=null, max_length: ge=null, return_tensor: Be=!0, return_token_type_ids: je=null}={}) {
                let Ne = Array.isArray(i), Le;
                if (Ne) {
                    if (i.length === 0)
                        throw Error("text array must be non-empty");
                    if (F !== null) {
                        if (Array.isArray(F)) {
                            if (i.length !== F.length)
                                throw Error("text and text_pair must have the same length")
                        } else
                            throw Error("text_pair must also be an array");
                        Le = i.map( (ot, bt) => this._encode_plus(ot, {
                            text_pair: F[bt],
                            add_special_tokens: z,
                            return_token_type_ids: je
                        }))
                    } else
                        Le = i.map(ot => this._encode_plus(ot, {
                            add_special_tokens: z,
                            return_token_type_ids: je
                        }))
                } else {
                    if (i == null)
                        throw Error("text may not be null or undefined");
                    if (Array.isArray(F))
                        throw Error("When specifying `text_pair`, since `text` is a string, `text_pair` must also be a string (i.e., not an array).");
                    Le = [this._encode_plus(i, {
                        text_pair: F,
                        add_special_tokens: z,
                        return_token_type_ids: je
                    })]
                }
                if (ge === null ? ge = this.model_max_length : ne === null && (G === !0 ? (console.warn("`max_length` is ignored when `padding: true` and there is no truncation strategy. To pad to max length, use `padding: 'max_length'`."),
                ge = this.model_max_length) : G === !1 && (console.warn("Truncation was not explicitly activated but `max_length` is provided a specific value, please use `truncation: true` to explicitly truncate examples to max length."),
                ne = !0)),
                G === !0 && (ge = Math.min((0,
                R.max)(Le.map(ot => ot.input_ids.length))[0], ge ?? 1 / 0)),
                ge = Math.min(ge, this.model_max_length ?? 1 / 0),
                G || ne)
                    for (let ot = 0; ot < Le.length; ++ot)
                        Le[ot].input_ids.length !== ge && (Le[ot].input_ids.length > ge ? ne && Ws(Le[ot], ge) : G && ds(Le[ot], ge, bt => bt === "input_ids" ? this.pad_token_id : 0, this.padding_side));
                let _t = {};
                if (Be) {
                    if (!(G && ne) && Le.some(bt => {
                        for (let Vt of Object.keys(bt))
                            if (bt[Vt].length !== Le[0][Vt]?.length)
                                return !0;
                        return !1
                    }
                    ))
                        throw Error("Unable to create tensor, you should probably activate truncation and/or padding with 'padding=true' and 'truncation=true' to have batched tensors with the same length.");
                    let ot = [Le.length, Le[0].input_ids.length];
                    for (let bt of Object.keys(Le[0]))
                        _t[bt] = new C.Tensor("int64",BigInt64Array.from(Le.flatMap(Vt => Vt[bt]).map(BigInt)),ot)
                } else {
                    for (let ot of Object.keys(Le[0]))
                        _t[ot] = Le.map(bt => bt[ot]);
                    if (!Ne)
                        for (let ot of Object.keys(_t))
                            _t[ot] = _t[ot][0]
                }
                return _t
            }
            _encode_text(i) {
                if (i === null)
                    return null;
                let F = this.added_tokens_splitter.split(i);
                for (let G = 0; G < F.length; ++G) {
                    let ne = this.added_tokens_map.get(F[G]);
                    ne && (ne.lstrip && G > 0 && (F[G - 1] = F[G - 1].trimEnd()),
                    ne.rstrip && G < F.length - 1 && (F[G + 1] = F[G + 1].trimStart()))
                }
                return F.flatMap( (G, ne) => {
                    if (G.length === 0)
                        return [];
                    if (this.added_tokens_map.has(G))
                        return [G];
                    if (this.remove_space === !0 && (G = G.trim().split(/\s+/).join(" ")),
                    this.do_lowercase_and_remove_accent && (G = k(G)),
                    this.normalizer !== null && (G = this.normalizer(G)),
                    G.length === 0)
                        return [];
                    let ge = this.pre_tokenizer !== null ? this.pre_tokenizer(G, {
                        section_index: ne
                    }) : [G];
                    return this.model(ge)
                }
                )
            }
            _encode_plus(i, {text_pair: F=null, add_special_tokens: z=!0, return_token_type_ids: G=null}={}) {
                let {tokens: ne, token_type_ids: ge} = this._tokenize_helper(i, {
                    pair: F,
                    add_special_tokens: z
                })
                  , Be = this.model.convert_tokens_to_ids(ne)
                  , je = {
                    input_ids: Be,
                    attention_mask: new Array(Be.length).fill(1)
                };
                return (G ?? this.return_token_type_ids) && ge && (je.token_type_ids = ge),
                je
            }
            _tokenize_helper(i, {pair: F=null, add_special_tokens: z=!1}={}) {
                let G = this._encode_text(i)
                  , ne = this._encode_text(F);
                return this.post_processor ? this.post_processor(G, ne, {
                    add_special_tokens: z
                }) : {
                    tokens: (0,
                    h.mergeArrays)(G ?? [], ne ?? [])
                }
            }
            tokenize(i, {pair: F=null, add_special_tokens: z=!1}={}) {
                return this._tokenize_helper(i, {
                    pair: F,
                    add_special_tokens: z
                }).tokens
            }
            encode(i, {text_pair: F=null, add_special_tokens: z=!0, return_token_type_ids: G=null}={}) {
                return this._encode_plus(i, {
                    text_pair: F,
                    add_special_tokens: z,
                    return_token_type_ids: G
                }).input_ids
            }
            batch_decode(i, F={}) {
                return i instanceof C.Tensor && (i = i.tolist()),
                i.map(z => this.decode(z, F))
            }
            decode(i, F={}) {
                if (i instanceof C.Tensor && (i = y(i)),
                !Array.isArray(i) || i.length === 0 || !(0,
                h.isIntegralNumber)(i[0]))
                    throw Error("token_ids must be a non-empty array of integers.");
                return this.decode_single(i, F)
            }
            decode_single(i, {skip_special_tokens: F=!1, clean_up_tokenization_spaces: z=null}) {
                let G = this.model.convert_ids_to_tokens(i);
                F && (G = G.filter(ge => !this.special_tokens.includes(ge)));
                let ne = this.decoder ? this.decoder(G) : G.join(" ");
                return this.decoder && this.decoder.end_of_word_suffix && (ne = ne.replaceAll(this.decoder.end_of_word_suffix, " "),
                F && (ne = ne.trim())),
                (z ?? this.clean_up_tokenization_spaces) && (ne = W(ne)),
                ne
            }
            get_chat_template({chat_template: i=null, tools: F=null}={}) {
                if (this.chat_template && typeof this.chat_template == "object") {
                    let z = this.chat_template;
                    if (i !== null && Object.hasOwn(z, i))
                        i = z[i];
                    else if (i === null)
                        if (F !== null && "tool_use"in z)
                            i = z.tool_use;
                        else if ("default"in z)
                            i = z.default;
                        else
                            throw Error(`This model has multiple chat templates with no default specified! Please either pass a chat template or the name of the template you wish to use to the 'chat_template' argument. Available template names are ${Object.keys(z).sort()}.`)
                } else if (i === null)
                    if (this.chat_template)
                        i = this.chat_template;
                    else
                        throw Error("Cannot use apply_chat_template() because tokenizer.chat_template is not set and no template argument was passed! For information about writing templates and setting the tokenizer.chat_template attribute, please see the documentation at https://huggingface.co/docs/transformers/main/en/chat_templating");
                return i
            }
            apply_chat_template(i, {tools: F=null, documents: z=null, chat_template: G=null, add_generation_prompt: ne=!1, tokenize: ge=!0, padding: Be=!1, truncation: je=!1, max_length: Ne=null, return_tensor: Le=!0, return_dict: _t=!1, tokenizer_kwargs: ot={}, ...bt}={}) {
                if (G = this.get_chat_template({
                    chat_template: G,
                    tools: F
                }),
                typeof G != "string")
                    throw Error(`chat_template must be a string, but got ${typeof G}`);
                let Vt = this._compiled_template_cache.get(G);
                Vt === void 0 && (Vt = new f.Template(G),
                this._compiled_template_cache.set(G, Vt));
                let kt = Object.create(null);
                for (let Rt of Gs) {
                    let is = this.getToken(Rt);
                    is && (kt[Rt] = is)
                }
                let Wt = Vt.render({
                    messages: i,
                    add_generation_prompt: ne,
                    tools: F,
                    documents: z,
                    ...kt,
                    ...bt
                });
                if (ge) {
                    let Rt = this._call(Wt, {
                        add_special_tokens: !1,
                        padding: Be,
                        truncation: je,
                        max_length: Ne,
                        return_tensor: Le,
                        ...ot
                    });
                    return _t ? Rt : Rt.input_ids
                }
                return Wt
            }
        }
        class Ls extends Ye {
            return_token_type_ids = !0
        }
        class nt extends Ye {
            return_token_type_ids = !0
        }
        class As extends Ye {
            return_token_type_ids = !0
        }
        class n extends Ye {
            return_token_type_ids = !0
        }
        class B extends Ye {
            return_token_type_ids = !0
        }
        class w extends Ye {
            return_token_type_ids = !0
        }
        class O extends Ye {
            return_token_type_ids = !0
        }
        class K extends Ye {
            return_token_type_ids = !0
        }
        class ie extends Ye {
            return_token_type_ids = !0
        }
        class fe extends Ye {
        }
        class Ue extends Ye {
        }
        class Qe extends Ye {
            return_token_type_ids = !0;
            constructor(i, F) {
                super(i, F),
                console.warn('WARNING: `XLMTokenizer` is not yet supported by Hugging Face\'s "fast" tokenizers library. Therefore, you may experience slightly inaccurate results.')
            }
        }
        class Oe extends Ye {
            return_token_type_ids = !0
        }
        class lt extends Ye {
        }
        class ct extends Ye {
        }
        class St extends Ye {
        }
        class ft extends Ye {
            constructor(i, F) {
                super(i, F),
                this.languageRegex = /^[a-z]{2}_[A-Z]{2}$/,
                this.language_codes = this.special_tokens.filter(z => this.languageRegex.test(z)),
                this.lang_to_token = z => z
            }
            _build_translation_inputs(i, F, z) {
                return bs(this, i, F, z)
            }
        }
        class es extends ft {
        }
        class ss extends Ye {
        }
        class Jt extends Ye {
        }
        let Bt = "\u2581";
        class rs extends Ye {
            padding_side = "left";
            constructor(i, F) {
                super(i, F),
                this.legacy = F.legacy ?? !0,
                this.legacy || (this.normalizer = null,
                this.pre_tokenizer = new ht({
                    replacement: Bt,
                    prepend_scheme: "first"
                }))
            }
            _encode_text(i) {
                if (i === null)
                    return null;
                if (this.legacy || i.length === 0)
                    return super._encode_text(i);
                let F = super._encode_text(Bt + i.replaceAll(Bt, " "));
                return F.length > 1 && F[0] === Bt && this.special_tokens.includes(F[1]) && (F = F.slice(1)),
                F
            }
        }
        class Ps extends Ye {
        }
        class Ts extends Ye {
        }
        class hs extends Ye {
        }
        class ys extends Ye {
        }
        class ws extends Ye {
        }
        class os extends Ye {
        }
        class us extends Ye {
        }
        class ps extends Ye {
        }
        class Ds extends Ye {
        }
        function bs(q, i, F, z) {
            if (!("language_codes"in q) || !Array.isArray(q.language_codes))
                throw new Error("Tokenizer must have `language_codes` attribute set and it should be an array of language ids.");
            if (!("languageRegex"in q) || !(q.languageRegex instanceof RegExp))
                throw new Error("Tokenizer must have `languageRegex` attribute set and it should be a regular expression.");
            if (!("lang_to_token"in q) || typeof q.lang_to_token != "function")
                throw new Error("Tokenizer must have `lang_to_token` attribute set and it should be a function.");
            let G = z.src_lang
              , ne = z.tgt_lang;
            if (!q.language_codes.includes(ne))
                throw new Error(`Target language code "${ne}" is not valid. Must be one of: {${q.language_codes.join(", ")}}`);
            if (G !== void 0) {
                if (!q.language_codes.includes(G))
                    throw new Error(`Source language code "${G}" is not valid. Must be one of: {${q.language_codes.join(", ")}}`);
                for (let ge of q.post_processor.config.single)
                    if ("SpecialToken"in ge && q.languageRegex.test(ge.SpecialToken.id)) {
                        ge.SpecialToken.id = q.lang_to_token(G);
                        break
                    }
            }
            return z.forced_bos_token_id = q.model.convert_tokens_to_ids([q.lang_to_token(ne)])[0],
            q._call(i, F)
        }
        class xs extends Ye {
            constructor(i, F) {
                super(i, F),
                this.languageRegex = /^[a-z]{3}_[A-Z][a-z]{3}$/,
                this.language_codes = this.special_tokens.filter(z => this.languageRegex.test(z)),
                this.lang_to_token = z => z
            }
            _build_translation_inputs(i, F, z) {
                return bs(this, i, F, z)
            }
        }
        class as extends Ye {
            constructor(i, F) {
                super(i, F),
                this.languageRegex = /^__[a-z]{2,3}__$/,
                this.language_codes = this.special_tokens.filter(z => this.languageRegex.test(z)).map(z => z.slice(2, -2)),
                this.lang_to_token = z => `__${z}__`
            }
            _build_translation_inputs(i, F, z) {
                return bs(this, i, F, z)
            }
        }
        class vs extends Ye {
            get timestamp_begin() {
                return this.model.convert_tokens_to_ids(["<|notimestamps|>"])[0] + 1
            }
            _decode_asr(i, {return_timestamps: F=!1, return_language: z=!1, time_precision: G=null, force_full_sequences: ne=!0}={}) {
                if (G === null)
                    throw Error("Must specify time_precision");
                let ge = null
                  , Be = F === "word";
                function je() {
                    return {
                        language: ge,
                        timestamp: [null, null],
                        text: ""
                    }
                }
                let Ne = []
                  , Le = je()
                  , _t = 0
                  , ot = this.timestamp_begin
                  , Vt = ot + 1500
                  , kt = []
                  , Wt = []
                  , Rt = !1
                  , is = null
                  , fs = new Set(this.all_special_ids);
                for (let xt of i) {
                    let Lt = xt.tokens
                      , qt = Be ? xt.token_timestamps : null
                      , ms = null
                      , gs = ot;
                    if ("stride"in xt) {
                        let[zt,At,yt] = xt.stride;
                        if (_t -= At,
                        is = zt - yt,
                        At && (gs = At / G + ot),
                        yt)
                            for (let Dt = Lt.length - 1; Dt >= 0; --Dt) {
                                let ts = Number(Lt[Dt]);
                                if (ts >= ot) {
                                    if (ms !== null && (ts - ot) * G < is)
                                        break;
                                    ms = ts
                                }
                            }
                    }
                    let Qt = []
                      , ls = [];
                    for (let zt = 0; zt < Lt.length; ++zt) {
                        let At = Number(Lt[zt]);
                        if (fs.has(At)) {
                            let yt = this.decode([At])
                              , Dt = L.WHISPER_LANGUAGE_MAPPING.get(yt.slice(2, -2));
                            if (Dt !== void 0) {
                                if (ge !== null && Dt !== ge && !F) {
                                    kt.push(Qt);
                                    let ts = this.findLongestCommonSequence(kt)[0]
                                      , Ms = this.decode(ts);
                                    Le.text = Ms,
                                    Ne.push(Le),
                                    kt = [],
                                    Qt = [],
                                    Le = je()
                                }
                                ge = Le.language = Dt
                            }
                        } else if (At >= ot && At <= Vt) {
                            let yt = (At - ot) * G + _t
                              , Dt = (0,
                            R.round)(yt, 2);
                            if (ms !== null && At >= ms)
                                Rt = !0;
                            else if (Rt || kt.length > 0 && At < gs)
                                Rt = !1;
                            else if (Le.timestamp[0] === null)
                                Le.timestamp[0] = Dt;
                            else if (Dt !== Le.timestamp[0]) {
                                Le.timestamp[1] = Dt,
                                kt.push(Qt),
                                Be && Wt.push(ls);
                                let[ts,Ms] = this.findLongestCommonSequence(kt, Wt)
                                  , ar = this.decode(ts);
                                Le.text = ar,
                                Be && (Le.words = this.collateWordTimestamps(ts, Ms, ge)),
                                Ne.push(Le),
                                kt = [],
                                Qt = [],
                                Wt = [],
                                ls = [],
                                Le = je()
                            }
                        } else if (Qt.push(At),
                        Be) {
                            let yt = (0,
                            R.round)(qt[zt] + _t, 2), Dt;
                            if (zt + 1 < qt.length) {
                                Dt = (0,
                                R.round)(qt[zt + 1] + _t, 2);
                                let ts = this.decode([At]);
                                o.test(ts) && (Dt = (0,
                                R.round)(Math.min(yt + G, Dt), 2))
                            } else
                                Dt = null;
                            ls.push([yt, Dt])
                        }
                    }
                    if ("stride"in xt) {
                        let[zt,At,yt] = xt.stride;
                        _t += zt - yt
                    }
                    Qt.length > 0 ? (kt.push(Qt),
                    Be && Wt.push(ls)) : kt.every(zt => zt.length === 0) && (Le = je(),
                    kt = [],
                    Qt = [],
                    Wt = [],
                    ls = [])
                }
                if (kt.length > 0) {
                    if (ne && F)
                        throw new Error("Whisper did not predict an ending timestamp, which can happen if audio is cut off in the middle of a word. Also make sure WhisperTimeStampLogitsProcessor was used during generation.");
                    let[xt,Lt] = this.findLongestCommonSequence(kt, Wt)
                      , qt = this.decode(xt);
                    Le.text = qt,
                    Be && (Le.words = this.collateWordTimestamps(xt, Lt, ge)),
                    Ne.push(Le)
                }
                let Xt = Object.create(null)
                  , Fs = Ne.map(xt => xt.text).join("");
                if (F || z) {
                    for (let xt = 0; xt < Ne.length; ++xt) {
                        let Lt = Ne[xt];
                        F || delete Lt.timestamp,
                        z || delete Lt.language
                    }
                    if (Be) {
                        let xt = [];
                        for (let Lt of Ne)
                            for (let qt of Lt.words)
                                xt.push(qt);
                        Xt = {
                            chunks: xt
                        }
                    } else
                        Xt = {
                            chunks: Ne
                        }
                }
                return [Fs, Xt]
            }
            findLongestCommonSequence(i, F=null) {
                let z = i[0]
                  , G = z.length
                  , ne = []
                  , ge = Array.isArray(F) && F.length > 0
                  , Be = ge ? [] : null
                  , je = ge ? F[0] : null;
                for (let Ne = 1; Ne < i.length; ++Ne) {
                    let Le = i[Ne]
                      , _t = 0
                      , ot = [G, G, 0, 0]
                      , bt = Le.length;
                    for (let Xt = 1; Xt < G + bt; ++Xt) {
                        let Fs = Math.max(0, G - Xt)
                          , xt = Math.min(G, G + bt - Xt)
                          , Lt = z.slice(Fs, xt)
                          , qt = Math.max(0, Xt - G)
                          , ms = Math.min(bt, Xt)
                          , gs = Le.slice(qt, ms);
                        if (Lt.length !== gs.length)
                            throw new Error("There is a bug within whisper `decode_asr` function, please report it. Dropping to prevent bad inference.");
                        let Qt;
                        ge ? Qt = Lt.filter( (At, yt) => At === gs[yt] && je[Fs + yt] <= F[Ne][qt + yt]).length : Qt = Lt.filter( (At, yt) => At === gs[yt]).length;
                        let ls = Xt / 1e4
                          , zt = Qt / Xt + ls;
                        Qt > 1 && zt > _t && (_t = zt,
                        ot = [Fs, xt, qt, ms])
                    }
                    let[Vt,kt,Wt,Rt] = ot
                      , is = Math.floor((kt + Vt) / 2)
                      , fs = Math.floor((Rt + Wt) / 2);
                    ne.push(...z.slice(0, is)),
                    z = Le.slice(fs),
                    G = z.length,
                    ge && (Be.push(...je.slice(0, is)),
                    je = F[Ne].slice(fs))
                }
                return ne.push(...z),
                ge ? (Be.push(...je),
                [ne, Be]) : [ne, []]
            }
            collateWordTimestamps(i, F, z) {
                let[G,ne,ge] = this.combineTokensIntoWords(i, z)
                  , Be = [];
                for (let je = 0; je < G.length; ++je) {
                    let Ne = ge[je];
                    Be.push({
                        text: G[je],
                        timestamp: [F[Ne.at(0)][0], F[Ne.at(-1)][1]]
                    })
                }
                return Be
            }
            combineTokensIntoWords(i, F, z=`"'\u201C\xA1\xBF([{-`, G=`"'.\u3002,\uFF0C!\uFF01?\uFF1F:\uFF1A\u201D)]}\u3001`) {
                F = F ?? "english";
                let ne, ge, Be;
                return ["chinese", "japanese", "thai", "lao", "myanmar"].includes(F) ? [ne,ge,Be] = this.splitTokensOnUnicode(i) : [ne,ge,Be] = this.splitTokensOnSpaces(i),
                this.mergePunctuations(ne, ge, Be, z, G)
            }
            decode(i, F) {
                let z;
                return F?.decode_with_timestamps ? (i instanceof C.Tensor && (i = y(i)),
                z = this.decodeWithTimestamps(i, F)) : z = super.decode(i, F),
                z
            }
            decodeWithTimestamps(i, F) {
                let z = F?.time_precision ?? .02
                  , G = Array.from(this.all_special_ids).at(-1) + 1
                  , ne = [[]];
                for (let ge of i)
                    if (ge = Number(ge),
                    ge >= G) {
                        let Be = ((ge - G) * z).toFixed(2);
                        ne.push(`<|${Be}|>`),
                        ne.push([])
                    } else
                        ne[ne.length - 1].push(ge);
                return ne = ne.map(ge => typeof ge == "string" ? ge : super.decode(ge, F)),
                ne.join("")
            }
            splitTokensOnUnicode(i) {
                let F = this.decode(i, {
                    decode_with_timestamps: !0
                })
                  , z = "\uFFFD"
                  , G = []
                  , ne = []
                  , ge = []
                  , Be = []
                  , je = []
                  , Ne = 0;
                for (let Le = 0; Le < i.length; ++Le) {
                    let _t = i[Le];
                    Be.push(_t),
                    je.push(Le);
                    let ot = this.decode(Be, {
                        decode_with_timestamps: !0
                    });
                    (!ot.includes(z) || F[Ne + ot.indexOf(z)] === z) && (G.push(ot),
                    ne.push(Be),
                    ge.push(je),
                    Be = [],
                    je = [],
                    Ne += ot.length)
                }
                return [G, ne, ge]
            }
            splitTokensOnSpaces(i) {
                let[F,z,G] = this.splitTokensOnUnicode(i)
                  , ne = []
                  , ge = []
                  , Be = []
                  , je = new RegExp(`^[${E}]$`,"gu");
                for (let Ne = 0; Ne < F.length; ++Ne) {
                    let Le = F[Ne]
                      , _t = z[Ne]
                      , ot = G[Ne]
                      , bt = _t[0] >= this.model.tokens_to_ids.get("<|endoftext|>")
                      , Vt = Le.startsWith(" ")
                      , kt = Le.trim()
                      , Wt = je.test(kt);
                    if (bt || Vt || Wt || ne.length === 0)
                        ne.push(Le),
                        ge.push(_t),
                        Be.push(ot);
                    else {
                        let Rt = ne.length - 1;
                        ne[Rt] += Le,
                        ge[Rt].push(..._t),
                        Be[Rt].push(...ot)
                    }
                }
                return [ne, ge, Be]
            }
            mergePunctuations(i, F, z, G, ne) {
                let ge = structuredClone(i)
                  , Be = structuredClone(F)
                  , je = structuredClone(z)
                  , Ne = ge.length - 2
                  , Le = ge.length - 1;
                for (; Ne >= 0; )
                    ge[Ne].startsWith(" ") && G.includes(ge[Ne].trim()) ? (ge[Le] = ge[Ne] + ge[Le],
                    Be[Le] = (0,
                    h.mergeArrays)(Be[Ne], Be[Le]),
                    je[Le] = (0,
                    h.mergeArrays)(je[Ne], je[Le]),
                    ge[Ne] = "",
                    Be[Ne] = [],
                    je[Ne] = []) : Le = Ne,
                    --Ne;
                for (Ne = 0,
                Le = 1; Le < ge.length; )
                    !ge[Ne].endsWith(" ") && ne.includes(ge[Le]) ? (ge[Ne] += ge[Le],
                    Be[Ne] = (0,
                    h.mergeArrays)(Be[Ne], Be[Le]),
                    je[Ne] = (0,
                    h.mergeArrays)(je[Ne], je[Le]),
                    ge[Le] = "",
                    Be[Le] = [],
                    je[Le] = []) : Ne = Le,
                    ++Le;
                return [ge.filter(_t => _t), Be.filter(_t => _t.length > 0), je.filter(_t => _t.length > 0)]
            }
        }
        class Is extends Ye {
        }
        class Yt extends Ye {
        }
        class Fe extends Ye {
        }
        class ke extends Ye {
            constructor(i, F) {
                super(i, F),
                this.languageRegex = /^(>>\w+<<)\s*/g,
                this.supported_language_codes = this.model.vocab.filter(z => this.languageRegex.test(z)),
                console.warn('WARNING: `MarianTokenizer` is not yet supported by Hugging Face\'s "fast" tokenizers library. Therefore, you may experience slightly inaccurate results.')
            }
            _encode_text(i) {
                if (i === null)
                    return null;
                let[F,...z] = i.trim().split(this.languageRegex);
                if (z.length === 0)
                    return super._encode_text(F);
                if (z.length === 2) {
                    let[G,ne] = z;
                    return this.supported_language_codes.includes(G) || console.warn(`Unsupported language code "${G}" detected, which may lead to unexpected behavior. Should be one of: ${JSON.stringify(this.supported_language_codes)}`),
                    (0,
                    h.mergeArrays)([G], super._encode_text(ne))
                }
            }
        }
        class Ke extends Ye {
        }
        class wt extends Ye {
        }
        class Os extends Ye {
        }
        class Es extends Ye {
        }
        class ns extends Ye {
        }
        class Ys extends Ye {
            constructor(i, F) {
                super(i, F),
                this.decoder = new qe({})
            }
        }
        class qs extends Ye {
        }
        class Zs extends Ye {
        }
        class er extends Ye {
        }
        class or {
            static TOKENIZER_CLASS_MAPPING = {
                T5Tokenizer: lt,
                DistilBertTokenizer: fe,
                CamembertTokenizer: Ue,
                DebertaTokenizer: B,
                DebertaV2Tokenizer: w,
                BertTokenizer: Ls,
                HerbertTokenizer: O,
                ConvBertTokenizer: K,
                RoFormerTokenizer: ie,
                XLMTokenizer: Qe,
                ElectraTokenizer: Oe,
                MobileBertTokenizer: As,
                SqueezeBertTokenizer: n,
                AlbertTokenizer: nt,
                GPT2Tokenizer: ct,
                BartTokenizer: St,
                MBartTokenizer: ft,
                MBart50Tokenizer: es,
                RobertaTokenizer: ss,
                WhisperTokenizer: vs,
                CodeGenTokenizer: Is,
                CLIPTokenizer: Yt,
                SiglipTokenizer: Fe,
                MarianTokenizer: ke,
                BloomTokenizer: Jt,
                NllbTokenizer: xs,
                M2M100Tokenizer: as,
                LlamaTokenizer: rs,
                CodeLlamaTokenizer: Ps,
                XLMRobertaTokenizer: Ts,
                MPNetTokenizer: hs,
                FalconTokenizer: ys,
                GPTNeoXTokenizer: ws,
                EsmTokenizer: os,
                Wav2Vec2CTCTokenizer: Ke,
                BlenderbotTokenizer: wt,
                BlenderbotSmallTokenizer: Os,
                SpeechT5Tokenizer: Es,
                NougatTokenizer: ns,
                VitsTokenizer: Ys,
                Qwen2Tokenizer: us,
                GemmaTokenizer: ps,
                Grok1Tokenizer: Ds,
                CohereTokenizer: qs,
                MgpstrTokenizer: Zs,
                Ernie4_5_Tokenizer: er,
                PreTrainedTokenizer: Ye
            };
            static async from_pretrained(i, {progress_callback: F=null, config: z=null, cache_dir: G=null, local_files_only: ne=!1, revision: ge="main", legacy: Be=null}={}) {
                let[je,Ne] = await _(i, {
                    progress_callback: F,
                    config: z,
                    cache_dir: G,
                    local_files_only: ne,
                    revision: ge,
                    legacy: Be
                })
                  , Le = Ne.tokenizer_class?.replace(/Fast$/, "") ?? "PreTrainedTokenizer"
                  , _t = this.TOKENIZER_CLASS_MAPPING[Le];
                return _t || (console.warn(`Unknown tokenizer class "${Le}", attempting to construct from base class.`),
                _t = Ye),
                new _t(je,Ne)
            }
        }
    }
    ),
    "./src/utils/audio.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            RawAudio: () => j,
            hamming: () => a,
            hanning: () => _,
            mel_filter_bank: () => I,
            read_audio: () => f,
            spectrogram: () => d,
            window_function: () => x
        });
        var l = e("./src/utils/hub.js")
          , h = e("./src/utils/maths.js")
          , b = e("./src/utils/core.js")
          , R = e("./src/env.js")
          , C = e("./src/utils/tensor.js")
          , M = e("?7992");
        async function f(D, $) {
            if (typeof AudioContext > "u")
                throw Error("Unable to load audio from path/URL since `AudioContext` is not available in your environment. Instead, audio data should be passed directly to the pipeline/processor. For more information and some example code, see https://huggingface.co/docs/transformers.js/guides/node-audio-processing.");
            let U = await (await (0,
            l.getFile)(D)).arrayBuffer()
              , H = new AudioContext({
                sampleRate: $
            });
            typeof $ > "u" && console.warn(`No sampling rate provided, using default of ${H.sampleRate}Hz.`);
            let Z = await H.decodeAudioData(U), ee;
            if (Z.numberOfChannels === 2) {
                let le = Math.sqrt(2)
                  , we = Z.getChannelData(0)
                  , ce = Z.getChannelData(1);
                ee = new Float32Array(we.length);
                for (let Q = 0; Q < Z.length; ++Q)
                    ee[Q] = le * (we[Q] + ce[Q]) / 2
            } else
                ee = Z.getChannelData(0);
            return ee
        }
        function L(D, $) {
            if (D < 1)
                return new Float64Array;
            if (D === 1)
                return new Float64Array([1]);
            let U = 1 - $
              , H = 2 * Math.PI / (D - 1)
              , Z = new Float64Array(D);
            for (let ee = 0; ee < D; ++ee)
                Z[ee] = $ - U * Math.cos(ee * H);
            return Z
        }
        function _(D) {
            return L(D, .5)
        }
        function a(D) {
            return L(D, .54)
        }
        let v = {
            htk: D => 2595 * Math.log10(1 + D / 700),
            kaldi: D => 1127 * Math.log(1 + D / 700),
            slaney: (D, $=1e3, U=15, H=27 / Math.log(6.4)) => D >= $ ? U + Math.log(D / $) * H : 3 * D / 200
        };
        function g(D, $="htk") {
            let U = v[$];
            if (!U)
                throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
            return typeof D == "number" ? U(D) : D.map(H => U(H))
        }
        let y = {
            htk: D => 700 * (10 ** (D / 2595) - 1),
            kaldi: D => 700 * (Math.exp(D / 1127) - 1),
            slaney: (D, $=1e3, U=15, H=Math.log(6.4) / 27) => D >= U ? $ * Math.exp(H * (D - U)) : 200 * D / 3
        };
        function W(D, $="htk") {
            let U = y[$];
            if (!U)
                throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
            return typeof D == "number" ? U(D) : D.map(H => U(H))
        }
        function T(D, $) {
            let U = Float64Array.from({
                length: $.length - 1
            }, (le, we) => $[we + 1] - $[we])
              , H = Array.from({
                length: D.length
            }, () => new Array($.length));
            for (let le = 0; le < D.length; ++le) {
                let we = H[le];
                for (let ce = 0; ce < $.length; ++ce)
                    we[ce] = $[ce] - D[le]
            }
            let Z = $.length - 2
              , ee = Array.from({
                length: Z
            }, () => new Array(D.length));
            for (let le = 0; le < D.length; ++le) {
                let we = H[le];
                for (let ce = 0; ce < Z; ++ce) {
                    let Q = -we[ce] / U[ce]
                      , A = we[ce + 2] / U[ce + 1];
                    ee[ce][le] = Math.max(0, Math.min(Q, A))
                }
            }
            return ee
        }
        function k(D, $, U) {
            let H = ($ - D) / (U - 1);
            return Float64Array.from({
                length: U
            }, (Z, ee) => D + H * ee)
        }
        function I(D, $, U, H, Z, ee=null, le="htk", we=!1) {
            if (ee !== null && ee !== "slaney")
                throw new Error('norm must be one of null or "slaney"');
            if (D < 2)
                throw new Error(`Require num_frequency_bins: ${D} >= 2`);
            if (U > H)
                throw new Error(`Require min_frequency: ${U} <= max_frequency: ${H}`);
            let ce = g(U, le), Q = g(H, le), A = k(ce, Q, $ + 2), V = W(A, le), J;
            if (we) {
                let xe = Z / ((D - 1) * 2);
                J = g(Float64Array.from({
                    length: D
                }, (be, Ae) => Ae * xe), le),
                V = A
            } else
                J = k(0, Math.floor(Z / 2), D);
            let ae = T(J, V);
            if (ee !== null && ee === "slaney")
                for (let xe = 0; xe < $; ++xe) {
                    let be = ae[xe]
                      , Ae = 2 / (V[xe + 2] - V[xe]);
                    for (let We = 0; We < D; ++We)
                        be[We] *= Ae
                }
            return ae
        }
        function p(D, $, U) {
            let H = new D.constructor(D.length + $ + U)
              , Z = D.length - 1;
            for (let ee = 0; ee < D.length; ++ee)
                H[$ + ee] = D[ee];
            for (let ee = 1; ee <= $; ++ee)
                H[$ - ee] = D[(0,
                b.calculateReflectOffset)(ee, Z)];
            for (let ee = 1; ee <= U; ++ee)
                H[Z + $ + ee] = D[(0,
                b.calculateReflectOffset)(Z - ee, Z)];
            return H
        }
        function m(D, $, U, H, Z) {
            if (U <= 0)
                throw new Error("reference must be greater than zero");
            if (H <= 0)
                throw new Error("min_value must be greater than zero");
            U = Math.max(H, U);
            let ee = Math.log10(U);
            for (let le = 0; le < D.length; ++le)
                D[le] = $ * Math.log10(Math.max(H, D[le]) - ee);
            if (Z !== null) {
                if (Z <= 0)
                    throw new Error("db_range must be greater than zero");
                let le = (0,
                h.max)(D)[0] - Z;
                for (let we = 0; we < D.length; ++we)
                    D[we] = Math.max(D[we], le)
            }
            return D
        }
        function E(D, $=1, U=1e-5, H=null) {
            return m(D, 20, $, U, H)
        }
        function o(D, $=1, U=1e-10, H=null) {
            return m(D, 10, $, U, H)
        }
        async function d(D, $, U, H, {fft_length: Z=null, power: ee=1, center: le=!0, pad_mode: we="reflect", onesided: ce=!0, preemphasis: Q=null, preemphasis_htk_flavor: A=!0, mel_filters: V=null, mel_floor: J=1e-10, log_mel: ae=null, reference: xe=1, min_value: be=1e-10, db_range: Ae=null, remove_dc_offset: We=null, min_num_frames: he=null, max_num_frames: c=null, do_pad: Y=!0, transpose: _e=!1, mel_offset: ue=0}={}) {
            let Me = $.length;
            if (Z === null && (Z = U),
            U > Z)
                throw Error(`frame_length (${U}) may not be larger than fft_length (${Z})`);
            if (Me !== U)
                throw new Error(`Length of the window (${Me}) must equal frame_length (${U})`);
            if (H <= 0)
                throw new Error("hop_length must be greater than zero");
            if (ee === null && V !== null)
                throw new Error("You have provided `mel_filters` but `power` is `None`. Mel spectrogram computation is not yet supported for complex-valued spectrogram. Specify `power` to fix this issue.");
            if (!A)
                throw new Error("`preemphasis_htk_flavor=false` is not currently supported.");
            if (le)
                switch (we) {
                case "reflect":
                    {
                        let $e = Math.floor((Z - 1) / 2) + 1;
                        D = p(D, $e, $e);
                        break
                    }
                case "constant":
                    {
                        let $e = Math.floor(Z / 2)
                          , ze = new D.constructor(D.length + 2 * $e);
                        ze.set(D, $e),
                        D = ze;
                        break
                    }
                default:
                    throw new Error(`pad_mode="${we}" not implemented yet.`)
                }
            let re = Math.floor(1 + Math.floor((D.length - U) / H));
            he !== null && re < he && (re = he);
            let pe = ce ? Math.floor(Z / 2) + 1 : Z
              , se = re
              , Te = re;
            c !== null && (c > re ? Y && (Te = c) : Te = se = c);
            let Ee = new h.FFT(Z)
              , ye = new Float64Array(Z)
              , Pe = new Float64Array(Ee.outputBufferSize)
              , Se = new Float32Array(pe * Te);
            for (let $e = 0; $e < se; ++$e) {
                let ze = $e * H
                  , Ze = Math.min(D.length - ze, U);
                Ze !== U && ye.fill(0, 0, U);
                for (let Ie = 0; Ie < Ze; ++Ie)
                    ye[Ie] = D[ze + Ie];
                if (We) {
                    let Ie = 0;
                    for (let qe = 0; qe < Ze; ++qe)
                        Ie += ye[qe];
                    let st = Ie / Ze;
                    for (let qe = 0; qe < Ze; ++qe)
                        ye[qe] -= st
                }
                if (Q !== null) {
                    for (let Ie = Ze - 1; Ie >= 1; --Ie)
                        ye[Ie] -= Q * ye[Ie - 1];
                    ye[0] *= 1 - Q
                }
                for (let Ie = 0; Ie < $.length; ++Ie)
                    ye[Ie] *= $[Ie];
                Ee.realTransform(Pe, ye);
                for (let Ie = 0; Ie < pe; ++Ie) {
                    let st = Ie << 1;
                    Se[Ie * Te + $e] = Pe[st] ** 2 + Pe[st + 1] ** 2
                }
            }
            if (ee !== null && ee !== 2) {
                let $e = ee / 2;
                for (let ze = 0; ze < Se.length; ++ze)
                    Se[ze] **= $e
            }
            let De = V.length
              , Ve = await (0,
            C.matmul)(new C.Tensor("float32",V.flat(),[De, pe]), new C.Tensor("float32",Se,[pe, Te]));
            _e && (Ve = Ve.transpose(1, 0));
            let Re = Ve.data;
            for (let $e = 0; $e < Re.length; ++$e)
                Re[$e] = ue + Math.max(J, Re[$e]);
            if (ee !== null && ae !== null) {
                let $e = Math.min(Re.length, se * De);
                switch (ae) {
                case "log":
                    for (let ze = 0; ze < $e; ++ze)
                        Re[ze] = Math.log(Re[ze]);
                    break;
                case "log10":
                    for (let ze = 0; ze < $e; ++ze)
                        Re[ze] = Math.log10(Re[ze]);
                    break;
                case "dB":
                    if (ee === 1)
                        E(Re, xe, be, Ae);
                    else if (ee === 2)
                        o(Re, xe, be, Ae);
                    else
                        throw new Error(`Cannot use log_mel option '${ae}' with power ${ee}`);
                    break;
                default:
                    throw new Error(`log_mel must be one of null, 'log', 'log10' or 'dB'. Got '${ae}'`)
                }
            }
            return Ve
        }
        function x(D, $, {periodic: U=!0, frame_length: H=null, center: Z=!0}={}) {
            let ee = U ? D + 1 : D, le;
            switch ($) {
            case "boxcar":
                le = new Float64Array(ee).fill(1);
                break;
            case "hann":
            case "hann_window":
                le = _(ee);
                break;
            case "hamming":
                le = a(ee);
                break;
            case "povey":
                le = _(ee).map(we => Math.pow(we, .85));
                break;
            default:
                throw new Error(`Unknown window type ${$}.`)
            }
            if (U && (le = le.subarray(0, D)),
            H === null)
                return le;
            if (D > H)
                throw new Error(`Length of the window (${D}) may not be larger than frame_length (${H})`);
            return le
        }
        function S(D, $) {
            let U = 44
              , H = new ArrayBuffer(U + D.length * 4)
              , Z = new DataView(H);
            N(Z, 0, "RIFF"),
            Z.setUint32(4, 36 + D.length * 4, !0),
            N(Z, 8, "WAVE"),
            N(Z, 12, "fmt "),
            Z.setUint32(16, 16, !0),
            Z.setUint16(20, 3, !0),
            Z.setUint16(22, 1, !0),
            Z.setUint32(24, $, !0),
            Z.setUint32(28, $ * 4, !0),
            Z.setUint16(32, 4, !0),
            Z.setUint16(34, 32, !0),
            N(Z, 36, "data"),
            Z.setUint32(40, D.length * 4, !0);
            for (let ee = 0; ee < D.length; ++ee,
            U += 4)
                Z.setFloat32(U, D[ee], !0);
            return H
        }
        function N(D, $, U) {
            for (let H = 0; H < U.length; ++H)
                D.setUint8($ + H, U.charCodeAt(H))
        }
        class j {
            constructor($, U) {
                this.audio = $,
                this.sampling_rate = U
            }
            toWav() {
                return S(this.audio, this.sampling_rate)
            }
            toBlob() {
                let $ = this.toWav();
                return new Blob([$],{
                    type: "audio/wav"
                })
            }
            async save($) {
                let U;
                if (R.apis.IS_BROWSER_ENV) {
                    if (R.apis.IS_WEBWORKER_ENV)
                        throw new Error("Unable to save a file from a Web Worker.");
                    U = b.saveBlob
                } else if (R.apis.IS_FS_AVAILABLE)
                    U = async (H, Z) => {
                        let ee = await Z.arrayBuffer();
                        M.writeFileSync(H, __Buffer$.from(ee))
                    }
                    ;
                else
                    throw new Error("Unable to save because filesystem is disabled in this environment.");
                await U($, this.toBlob())
            }
        }
    }
    ),
    "./src/utils/constants.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            CHAT_TEMPLATE_NAME: () => M,
            CONFIG_NAME: () => h,
            FEATURE_EXTRACTOR_NAME: () => b,
            GENERATION_CONFIG_NAME: () => f,
            GITHUB_ISSUE_URL: () => l,
            IMAGE_PROCESSOR_NAME: () => R,
            PROCESSOR_NAME: () => C
        });
        let l = "https://github.com/huggingface/transformers.js/issues/new/choose"
          , h = "config.json"
          , b = "preprocessor_config.json"
          , R = b
          , C = "processor_config.json"
          , M = "chat_template.jinja"
          , f = "generation_config.json"
    }
    ),
    "./src/utils/core.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            calculateDimensions: () => f,
            calculateReflectOffset: () => v,
            count: () => T,
            dispatchCallback: () => l,
            escapeRegExp: () => b,
            isIntegralNumber: () => C,
            isNullishDimension: () => M,
            isTypedArray: () => R,
            len: () => W,
            mergeArrays: () => _,
            pick: () => y,
            pop: () => L,
            product: () => a,
            reverseDictionary: () => h,
            saveBlob: () => g
        });
        function l(k, I) {
            k && k(I)
        }
        function h(k) {
            return Object.fromEntries(Object.entries(k).map( ([I,p]) => [p, I]))
        }
        function b(k) {
            return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }
        function R(k) {
            return k?.prototype?.__proto__?.constructor?.name === "TypedArray"
        }
        function C(k) {
            return Number.isInteger(k) || typeof k == "bigint"
        }
        function M(k) {
            return k == null || k === -1
        }
        function f(k) {
            let I = []
              , p = k;
            for (; Array.isArray(p); )
                I.push(p.length),
                p = p[0];
            return I
        }
        function L(k, I, p=void 0) {
            let m = k[I];
            if (m !== void 0)
                return delete k[I],
                m;
            if (p === void 0)
                throw Error(`Key ${I} does not exist in object.`);
            return p
        }
        function _(...k) {
            return Array.prototype.concat.apply([], k)
        }
        function a(...k) {
            return k.reduce( (I, p) => I.flatMap(m => p.map(E => [m, E])))
        }
        function v(k, I) {
            return Math.abs((k + I) % (2 * I) - I)
        }
        function g(k, I) {
            let p = URL.createObjectURL(I)
              , m = document.createElement("a");
            m.href = p,
            m.download = k,
            m.click(),
            m.remove(),
            URL.revokeObjectURL(p)
        }
        function y(k, I) {
            return Object.assign({}, ...I.map(p => {
                if (k[p] !== void 0)
                    return {
                        [p]: k[p]
                    }
            }
            ))
        }
        function W(k) {
            let I = 0;
            for (let p of k)
                ++I;
            return I
        }
        function T(k, I) {
            let p = 0;
            for (let m of k)
                m === I && ++p;
            return p
        }
    }
    ),
    "./src/utils/data-structures.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            CharTrie: () => h,
            DictionarySplitter: () => M,
            LRUCache: () => f,
            PriorityQueue: () => l,
            TokenLattice: () => R
        });
        class l {
            constructor(_= (v, g) => v > g, a=1 / 0) {
                this._heap = [],
                this._comparator = _,
                this._maxSize = a
            }
            get size() {
                return this._heap.length
            }
            isEmpty() {
                return this.size === 0
            }
            peek() {
                return this._heap[0]
            }
            push(..._) {
                return this.extend(_)
            }
            extend(_) {
                for (let a of _)
                    if (this.size < this._maxSize)
                        this._heap.push(a),
                        this._siftUp();
                    else {
                        let v = this._smallest();
                        this._comparator(a, this._heap[v]) && (this._heap[v] = a,
                        this._siftUpFrom(v))
                    }
                return this.size
            }
            pop() {
                let _ = this.peek()
                  , a = this.size - 1;
                return a > 0 && this._swap(0, a),
                this._heap.pop(),
                this._siftDown(),
                _
            }
            replace(_) {
                let a = this.peek();
                return this._heap[0] = _,
                this._siftDown(),
                a
            }
            _parent(_) {
                return (_ + 1 >>> 1) - 1
            }
            _left(_) {
                return (_ << 1) + 1
            }
            _right(_) {
                return _ + 1 << 1
            }
            _greater(_, a) {
                return this._comparator(this._heap[_], this._heap[a])
            }
            _swap(_, a) {
                let v = this._heap[_];
                this._heap[_] = this._heap[a],
                this._heap[a] = v
            }
            _siftUp() {
                this._siftUpFrom(this.size - 1)
            }
            _siftUpFrom(_) {
                for (; _ > 0 && this._greater(_, this._parent(_)); )
                    this._swap(_, this._parent(_)),
                    _ = this._parent(_)
            }
            _siftDown() {
                let _ = 0;
                for (; this._left(_) < this.size && this._greater(this._left(_), _) || this._right(_) < this.size && this._greater(this._right(_), _); ) {
                    let a = this._right(_) < this.size && this._greater(this._right(_), this._left(_)) ? this._right(_) : this._left(_);
                    this._swap(_, a),
                    _ = a
                }
            }
            _smallest() {
                return 2 ** Math.floor(Math.log2(this.size)) - 1
            }
        }
        class h {
            constructor() {
                this.root = b.default()
            }
            extend(_) {
                for (let a of _)
                    this.push(a)
            }
            push(_) {
                let a = this.root;
                for (let v of _) {
                    let g = a.children.get(v);
                    g === void 0 && (g = b.default(),
                    a.children.set(v, g)),
                    a = g
                }
                a.isLeaf = !0
            }
            *commonPrefixSearch(_) {
                let a = this.root;
                if (a === void 0)
                    return;
                let v = "";
                for (let g of _) {
                    if (v += g,
                    a = a.children.get(g),
                    a === void 0)
                        return;
                    a.isLeaf && (yield v)
                }
            }
        }
        class b {
            constructor(_, a) {
                this.isLeaf = _,
                this.children = a
            }
            static default() {
                return new b(!1,new Map)
            }
        }
        class R {
            constructor(_, a, v) {
                this.chars = Array.from(_),
                this.len = this.chars.length,
                this.bosTokenId = a,
                this.eosTokenId = v,
                this.nodes = [],
                this.beginNodes = Array.from({
                    length: this.len + 1
                }, () => []),
                this.endNodes = Array.from({
                    length: this.len + 1
                }, () => []);
                let g = new C(this.bosTokenId,0,0,0,0)
                  , y = new C(this.eosTokenId,1,this.len,0,0);
                this.nodes.push(g.clone()),
                this.nodes.push(y.clone()),
                this.beginNodes[this.len].push(y),
                this.endNodes[0].push(g)
            }
            insert(_, a, v, g) {
                let y = this.nodes.length
                  , W = new C(g,y,_,a,v);
                this.beginNodes[_].push(W),
                this.endNodes[_ + a].push(W),
                this.nodes.push(W)
            }
            viterbi() {
                let _ = this.len
                  , a = 0;
                for (; a <= _; ) {
                    if (this.beginNodes[a].length == 0)
                        return [];
                    for (let T of this.beginNodes[a]) {
                        T.prev = null;
                        let k = 0
                          , I = null;
                        for (let p of this.endNodes[a]) {
                            let m = p.backtraceScore + T.score;
                            (I === null || m > k) && (I = p.clone(),
                            k = m)
                        }
                        if (I !== null)
                            T.prev = I,
                            T.backtraceScore = k;
                        else
                            return []
                    }
                    ++a
                }
                let v = []
                  , y = this.beginNodes[_][0].prev;
                if (y === null)
                    return [];
                let W = y.clone();
                for (; W.prev !== null; )
                    v.push(W.clone()),
                    W = W.clone().prev.clone();
                return v.reverse(),
                v
            }
            piece(_) {
                return this.chars.slice(_.pos, _.pos + _.length).join("")
            }
            tokens() {
                return this.viterbi().map(a => this.piece(a))
            }
            tokenIds() {
                return this.viterbi().map(a => a.tokenId)
            }
        }
        class C {
            constructor(_, a, v, g, y) {
                this.tokenId = _,
                this.nodeId = a,
                this.pos = v,
                this.length = g,
                this.score = y,
                this.prev = null,
                this.backtraceScore = 0
            }
            clone() {
                let _ = new C(this.tokenId,this.nodeId,this.pos,this.length,this.score);
                return _.prev = this.prev,
                _.backtraceScore = this.backtraceScore,
                _
            }
        }
        class M {
            constructor(_) {
                this.trie = this._buildTrie(_)
            }
            _buildTrie(_) {
                let a = Object.create(null);
                for (let v of _) {
                    let g = a;
                    for (let y = 0; y < v.length; ++y)
                        g = g[v[y]] ??= Object.create(null);
                    g.end = v
                }
                return a
            }
            split(_) {
                let a = []
                  , v = _.length
                  , g = 0
                  , y = 0;
                for (; y < v; ) {
                    let W = this.trie
                      , T = null
                      , k = y;
                    for (; k < v && (W = W[_[k]]); )
                        W.end && (T = W.end),
                        ++k;
                    T ? (y > g && a.push(_.slice(g, y)),
                    a.push(T),
                    y += T.length,
                    g = y) : ++y
                }
                return g < v && a.push(_.slice(g)),
                a
            }
        }
        class f {
            constructor(_) {
                this.capacity = _,
                this.cache = new Map
            }
            get(_) {
                if (!this.cache.has(_))
                    return;
                let a = this.cache.get(_);
                return this.cache.delete(_),
                this.cache.set(_, a),
                a
            }
            put(_, a) {
                this.cache.has(_) && this.cache.delete(_),
                this.cache.set(_, a),
                this.cache.size > this.capacity && this.cache.delete(this.cache.keys().next().value)
            }
            clear() {
                this.cache.clear()
            }
        }
    }
    ),
    "./src/utils/devices.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DEVICE_TYPES: () => l
        });
        let l = Object.freeze({
            auto: "auto",
            gpu: "gpu",
            cpu: "cpu",
            wasm: "wasm",
            webgpu: "webgpu",
            cuda: "cuda",
            dml: "dml",
            webnn: "webnn",
            "webnn-npu": "webnn-npu",
            "webnn-gpu": "webnn-gpu",
            "webnn-cpu": "webnn-cpu"
        })
    }
    ),
    "./src/utils/dtypes.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DATA_TYPES: () => R,
            DEFAULT_DEVICE_DTYPE_MAPPING: () => C,
            DEFAULT_DTYPE_SUFFIX_MAPPING: () => M,
            isWebGpuFp16Supported: () => b
        });
        var l = e("./src/env.js")
          , h = e("./src/utils/devices.js");
        let b = (function() {
            let f;
            return async function() {
                if (f === void 0)
                    if (!l.apis.IS_WEBGPU_AVAILABLE)
                        f = !1;
                    else
                        try {
                            f = (await navigator.gpu.requestAdapter()).features.has("shader-f16")
                        } catch {
                            f = !1
                        }
                return f
            }
        }
        )()
          , R = Object.freeze({
            auto: "auto",
            fp32: "fp32",
            fp16: "fp16",
            q8: "q8",
            int8: "int8",
            uint8: "uint8",
            q4: "q4",
            bnb4: "bnb4",
            q4f16: "q4f16"
        })
          , C = Object.freeze({
            [h.DEVICE_TYPES.wasm]: R.q8
        })
          , M = Object.freeze({
            [R.fp32]: "",
            [R.fp16]: "_fp16",
            [R.int8]: "_int8",
            [R.uint8]: "_uint8",
            [R.q8]: "_quantized",
            [R.q4]: "_q4",
            [R.q4f16]: "_q4f16",
            [R.bnb4]: "_bnb4"
        })
    }
    ),
    "./src/utils/generic.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            Callable: () => l
        });
        let l = class {
            constructor() {
                let h = function(...b) {
                    return h._call(...b)
                };
                return Object.setPrototypeOf(h, new.target.prototype)
            }
            _call(...h) {
                throw Error("Must implement _call method in subclass")
            }
        }
    }
    ),
    "./src/utils/hub.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            MAX_EXTERNAL_DATA_CHUNKS: () => C,
            getFile: () => v,
            getModelFile: () => k,
            getModelJSON: () => p,
            getModelText: () => I
        });
        var l = e("?7992")
          , h = e("?5af5")
          , b = e("./src/env.js")
          , R = e("./src/utils/core.js");
        let C = 100
          , M = {
            txt: "text/plain",
            html: "text/html",
            css: "text/css",
            js: "text/javascript",
            json: "application/json",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif"
        };
        class f {
            constructor(d) {
                if (this.filePath = d,
                this.headers = new Headers,
                this.exists = l.existsSync(d),
                this.exists) {
                    this.status = 200,
                    this.statusText = "OK";
                    let x = l.statSync(d);
                    this.headers.set("content-length", x.size.toString()),
                    this.updateContentType();
                    let S = l.createReadStream(d);
                    this.body = new ReadableStream({
                        start(N) {
                            S.on("data", j => N.enqueue(j)),
                            S.on("end", () => N.close()),
                            S.on("error", j => N.error(j))
                        },
                        cancel() {
                            S.destroy()
                        }
                    })
                } else
                    this.status = 404,
                    this.statusText = "Not Found",
                    this.body = null
            }
            updateContentType() {
                let d = this.filePath.toString().split(".").pop().toLowerCase();
                this.headers.set("content-type", M[d] ?? "application/octet-stream")
            }
            clone() {
                let d = new f(this.filePath);
                return d.exists = this.exists,
                d.status = this.status,
                d.statusText = this.statusText,
                d.headers = new Headers(this.headers),
                d
            }
            async arrayBuffer() {
                return (await l.promises.readFile(this.filePath)).buffer
            }
            async blob() {
                let d = await l.promises.readFile(this.filePath);
                return new Blob([d],{
                    type: this.headers.get("content-type")
                })
            }
            async text() {
                return await l.promises.readFile(this.filePath, "utf8")
            }
            async json() {
                return JSON.parse(await this.text())
            }
        }
        function L(o, d=null, x=null) {
            let S;
            try {
                S = new URL(o)
            } catch {
                return !1
            }
            return !(d && !d.includes(S.protocol) || x && !x.includes(S.hostname))
        }
        let _ = /^(\b[\w\-.]+\b\/)?\b[\w\-.]{1,96}\b$/;
        function a(o) {
            return !(!_.test(o) || o.includes("..") || o.includes("--") || o.endsWith(".git") || o.endsWith(".ipynb"))
        }
        async function v(o) {
            if (b.env.useFS && !L(o, ["http:", "https:", "blob:"]))
                return new f(o instanceof URL ? o.protocol === "file:" ? o.pathname : o.toString() : o);
            if (typeof __Process$ < "u" && __Process$?.release?.name === "node") {
                let d = !!__Process$.env?.TESTING_REMOTELY
                  , x = b.env.version
                  , S = new Headers;
                if (S.set("User-Agent", `transformers.js/${x}; is_ci/${d};`),
                L(o, ["http:", "https:"], ["huggingface.co", "hf.co"])) {
                    let j = __Process$.env?.HF_TOKEN ?? __Process$.env?.HF_ACCESS_TOKEN;
                    j && S.set("Authorization", `Bearer ${j}`)
                }
                return fetch(o, {
                    headers: S
                })
            } else
                return fetch(o)
        }
        let g = {
            400: "Bad request error occurred while trying to load file",
            401: "Unauthorized access to file",
            403: "Forbidden access to file",
            404: "Could not locate file",
            408: "Request timeout error occurred while trying to load file",
            500: "Internal server error error occurred while trying to load file",
            502: "Bad gateway error occurred while trying to load file",
            503: "Service unavailable error occurred while trying to load file",
            504: "Gateway timeout error occurred while trying to load file"
        };
        function y(o, d, x) {
            if (!x)
                return null;
            let S = g[o] ?? `Error (${o}) occurred while trying to load file`;
            throw Error(`${S}: "${d}".`)
        }
        class W {
            constructor(d) {
                this.path = d
            }
            async match(d) {
                let x = h.join(this.path, d)
                  , S = new f(x);
                if (S.exists)
                    return S
            }
            async put(d, x, S=void 0) {
                let N = h.join(this.path, d);
                try {
                    let j = x.headers.get("Content-Length")
                      , D = parseInt(j ?? "0")
                      , $ = 0;
                    await l.promises.mkdir(h.dirname(N), {
                        recursive: !0
                    });
                    let U = l.createWriteStream(N)
                      , H = x.body.getReader();
                    for (; ; ) {
                        let {done: Z, value: ee} = await H.read();
                        if (Z)
                            break;
                        await new Promise( (we, ce) => {
                            U.write(ee, Q => {
                                if (Q) {
                                    ce(Q);
                                    return
                                }
                                we()
                            }
                            )
                        }
                        ),
                        $ += ee.length;
                        let le = D ? $ / D * 100 : 0;
                        S?.({
                            progress: le,
                            loaded: $,
                            total: D
                        })
                    }
                    U.close()
                } catch (j) {
                    try {
                        await l.promises.unlink(N)
                    } catch {}
                    throw j
                }
            }
        }
        async function T(o, ...d) {
            for (let x of d)
                try {
                    let S = await o.match(x);
                    if (S)
                        return S
                } catch {
                    continue
                }
        }
        async function k(o, d, x=!0, S={}, N=!1) {
            if (!b.env.allowLocalModels) {
                if (S.local_files_only)
                    throw Error("Invalid configuration detected: local models are disabled (`env.allowLocalModels=false`) but you have requested to only use local models (`local_files_only=true`).");
                if (!b.env.allowRemoteModels)
                    throw Error("Invalid configuration detected: both local and remote models are disabled. Fix by setting `env.allowLocalModels` or `env.allowRemoteModels` to `true`.")
            }
            (0,
            R.dispatchCallback)(S.progress_callback, {
                status: "initiate",
                name: o,
                file: d
            });
            let j;
            if (!j && b.env.useCustomCache) {
                if (!b.env.customCache)
                    throw Error("`env.useCustomCache=true`, but `env.customCache` is not defined.");
                if (!b.env.customCache.match || !b.env.customCache.put)
                    throw new Error("`env.customCache` must be an object which implements the `match` and `put` functions of the Web Cache API. For more information, see https://developer.mozilla.org/en-US/docs/Web/API/Cache");
                j = b.env.customCache
            }
            if (!j && b.env.useBrowserCache) {
                if (typeof caches > "u")
                    throw Error("Browser cache is not available in this environment.");
                try {
                    j = await caches.open("transformers-cache")
                } catch (J) {
                    console.warn("An error occurred while opening the browser cache:", J)
                }
            }
            if (!j && b.env.useFSCache) {
                if (!b.apis.IS_FS_AVAILABLE)
                    throw Error("File System Cache is not available in this environment.");
                j = new W(S.cache_dir ?? b.env.cacheDir)
            }
            let D = S.revision ?? "main", $ = E(o, d), U = a(o), H = U ? E(b.env.localModelPath, $) : $, Z = E(b.env.remoteHost, b.env.remotePathTemplate.replaceAll("{model}", o).replaceAll("{revision}", encodeURIComponent(D)), d), ee, le = j instanceof W ? D === "main" ? $ : E(o, D, d) : Z, we = !1, ce;
            j && (ce = await T(j, H, le));
            let Q = ce !== void 0;
            if (ce === void 0) {
                if (b.env.allowLocalModels)
                    if (L($, ["http:", "https:"])) {
                        if (S.local_files_only)
                            throw new Error(`\`local_files_only=true\`, but attempted to load a remote file from: ${$}.`);
                        if (!b.env.allowRemoteModels)
                            throw new Error(`\`env.allowRemoteModels=false\`, but attempted to load a remote file from: ${$}.`)
                    } else
                        try {
                            ce = await v(H),
                            ee = H
                        } catch (ae) {
                            console.warn(`Unable to load from local path "${H}": "${ae}"`)
                        }
                if (ce === void 0 || ce.status === 404) {
                    if (S.local_files_only || !b.env.allowRemoteModels) {
                        if (x)
                            throw Error(`\`local_files_only=true\` or \`env.allowRemoteModels=false\` and file was not found locally at "${H}".`);
                        return null
                    }
                    if (!U)
                        throw Error(`Local file missing at "${H}" and download aborted due to invalid model ID "${o}".`);
                    if (ce = await v(Z),
                    ce.status !== 200)
                        return y(ce.status, Z, x);
                    ee = le
                }
                we = j && typeof Response < "u" && ce instanceof Response && ce.status === 200
            }
            (0,
            R.dispatchCallback)(S.progress_callback, {
                status: "download",
                name: o,
                file: d
            });
            let A;
            if (!(b.apis.IS_NODE_ENV && N)) {
                let J;
                S.progress_callback ? Q && typeof navigator < "u" && /firefox/i.test(navigator.userAgent) ? (J = new Uint8Array(await ce.arrayBuffer()),
                (0,
                R.dispatchCallback)(S.progress_callback, {
                    status: "progress",
                    name: o,
                    file: d,
                    progress: 100,
                    loaded: J.length,
                    total: J.length
                })) : J = await m(ce, ae => {
                    (0,
                    R.dispatchCallback)(S.progress_callback, {
                        status: "progress",
                        name: o,
                        file: d,
                        ...ae
                    })
                }
                ) : J = new Uint8Array(await ce.arrayBuffer()),
                A = J
            }
            if (we && ee && await j.match(ee) === void 0)
                if (A)
                    await j.put(ee, new Response(A,{
                        headers: ce.headers
                    })).catch(J => {
                        console.warn(`Unable to add response to browser cache: ${J}.`)
                    }
                    );
                else {
                    let J = S.progress_callback ? ae => (0,
                    R.dispatchCallback)(S.progress_callback, {
                        status: "progress",
                        name: o,
                        file: d,
                        ...ae
                    }) : void 0;
                    await j.put(ee, ce, J)
                }
            if ((0,
            R.dispatchCallback)(S.progress_callback, {
                status: "done",
                name: o,
                file: d
            }),
            A) {
                if (!b.apis.IS_NODE_ENV && N)
                    throw new Error("Cannot return path in a browser environment.");
                return A
            }
            if (ce instanceof f)
                return ce.filePath;
            let V = await j?.match(ee);
            if (V instanceof f)
                return V.filePath;
            if (V instanceof Response)
                return new Uint8Array(await V.arrayBuffer());
            if (typeof V == "string")
                return V;
            throw new Error("Unable to get model file path or buffer.")
        }
        async function I(o, d, x=!0, S={}) {
            let N = await k(o, d, x, S, !1);
            return N === null ? null : new TextDecoder("utf-8").decode(N)
        }
        async function p(o, d, x=!0, S={}) {
            let N = await I(o, d, x, S);
            return N === null ? {} : JSON.parse(N)
        }
        async function m(o, d) {
            let x = o.headers.get("Content-Length");
            x === null && console.warn("Unable to determine content-length from response headers. Will expand buffer when needed.");
            let S = parseInt(x ?? "0")
              , N = new Uint8Array(S)
              , j = 0
              , D = o.body.getReader();
            async function $() {
                let {done: U, value: H} = await D.read();
                if (U)
                    return;
                let Z = j + H.length;
                if (Z > S) {
                    S = Z;
                    let le = new Uint8Array(S);
                    le.set(N),
                    N = le
                }
                N.set(H, j),
                j = Z;
                let ee = j / S * 100;
                return d({
                    progress: ee,
                    loaded: j,
                    total: S
                }),
                $()
            }
            return await $(),
            N
        }
        function E(...o) {
            return o = o.map( (d, x) => (x && (d = d.replace(new RegExp("^/"), "")),
            x !== o.length - 1 && (d = d.replace(new RegExp("/$"), "")),
            d)),
            o.join("/")
        }
    }
    ),
    "./src/utils/image.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            RawImage: () => g,
            load_image: () => y
        });
        var l = e("./src/utils/core.js")
          , h = e("./src/utils/hub.js")
          , b = e("./src/env.js")
          , R = e("./src/utils/tensor.js")
          , C = e("?2b25");
        let M, f, L, _ = b.apis.IS_BROWSER_ENV || b.apis.IS_WEBWORKER_ENV;
        if (_)
            M = (W, T) => {
                if (!self.OffscreenCanvas)
                    throw new Error("OffscreenCanvas not supported by this browser.");
                return new self.OffscreenCanvas(W,T)
            }
            ,
            L = self.createImageBitmap,
            f = self.ImageData;
        else if (C)
            L = async W => {
                let k = (await W.metadata()).channels
                  , {data: I, info: p} = await W.rotate().raw().toBuffer({
                    resolveWithObject: !0
                })
                  , m = new g(new Uint8ClampedArray(I),p.width,p.height,p.channels);
                return k !== void 0 && k !== p.channels && m.convert(k),
                m
            }
            ;
        else
            throw new Error("Unable to load image processing library.");
        let a = {
            0: "nearest",
            1: "lanczos",
            2: "bilinear",
            3: "bicubic",
            4: "box",
            5: "hamming"
        }
          , v = new Map([["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["gif", "image/gif"]]);
        class g {
            constructor(T, k, I, p) {
                this.data = T,
                this.width = k,
                this.height = I,
                this.channels = p
            }
            get size() {
                return [this.width, this.height]
            }
            static async read(T) {
                if (T instanceof g)
                    return T;
                if (typeof T == "string" || T instanceof URL)
                    return await this.fromURL(T);
                if (T instanceof Blob)
                    return await this.fromBlob(T);
                if (typeof HTMLCanvasElement < "u" && T instanceof HTMLCanvasElement || typeof OffscreenCanvas < "u" && T instanceof OffscreenCanvas)
                    return this.fromCanvas(T);
                throw new Error(`Unsupported input type: ${typeof T}`)
            }
            static fromCanvas(T) {
                if (!_)
                    throw new Error("fromCanvas() is only supported in browser environments.");
                let I = T.getContext("2d").getImageData(0, 0, T.width, T.height).data;
                return new g(I,T.width,T.height,4)
            }
            static async fromURL(T) {
                let k = await (0,
                h.getFile)(T);
                if (k.status !== 200)
                    throw new Error(`Unable to read image from "${T}" (${k.status} ${k.statusText})`);
                let I = await k.blob();
                return this.fromBlob(I)
            }
            static async fromBlob(T) {
                if (_) {
                    let k = await L(T)
                      , I = M(k.width, k.height).getContext("2d");
                    return I.drawImage(k, 0, 0),
                    new this(I.getImageData(0, 0, k.width, k.height).data,k.width,k.height,4)
                } else {
                    let k = C(await T.arrayBuffer());
                    return await L(k)
                }
            }
            static fromTensor(T, k="CHW") {
                if (T.dims.length !== 3)
                    throw new Error(`Tensor should have 3 dimensions, but has ${T.dims.length} dimensions.`);
                if (k === "CHW")
                    T = T.transpose(1, 2, 0);
                else if (k !== "HWC")
                    throw new Error(`Unsupported channel format: ${k}`);
                if (!(T.data instanceof Uint8ClampedArray || T.data instanceof Uint8Array))
                    throw new Error(`Unsupported tensor type: ${T.type}`);
                switch (T.dims[2]) {
                case 1:
                case 2:
                case 3:
                case 4:
                    return new g(T.data,T.dims[1],T.dims[0],T.dims[2]);
                default:
                    throw new Error(`Unsupported number of channels: ${T.dims[2]}`)
                }
            }
            grayscale() {
                if (this.channels === 1)
                    return this;
                let T = new Uint8ClampedArray(this.width * this.height * 1);
                switch (this.channels) {
                case 3:
                case 4:
                    for (let k = 0, I = 0; k < this.data.length; k += this.channels) {
                        let p = this.data[k]
                          , m = this.data[k + 1]
                          , E = this.data[k + 2];
                        T[I++] = Math.round(.2989 * p + .587 * m + .114 * E)
                    }
                    break;
                default:
                    throw new Error(`Conversion failed due to unsupported number of channels: ${this.channels}`)
                }
                return this._update(T, this.width, this.height, 1)
            }
            rgb() {
                if (this.channels === 3)
                    return this;
                let T = new Uint8ClampedArray(this.width * this.height * 3);
                switch (this.channels) {
                case 1:
                    for (let k = 0, I = 0; k < this.data.length; ++k)
                        T[I++] = this.data[k],
                        T[I++] = this.data[k],
                        T[I++] = this.data[k];
                    break;
                case 4:
                    for (let k = 0, I = 0; k < this.data.length; k += 4)
                        T[I++] = this.data[k],
                        T[I++] = this.data[k + 1],
                        T[I++] = this.data[k + 2];
                    break;
                default:
                    throw new Error(`Conversion failed due to unsupported number of channels: ${this.channels}`)
                }
                return this._update(T, this.width, this.height, 3)
            }
            rgba() {
                if (this.channels === 4)
                    return this;
                let T = new Uint8ClampedArray(this.width * this.height * 4);
                switch (this.channels) {
                case 1:
                    for (let k = 0, I = 0; k < this.data.length; ++k)
                        T[I++] = this.data[k],
                        T[I++] = this.data[k],
                        T[I++] = this.data[k],
                        T[I++] = 255;
                    break;
                case 3:
                    for (let k = 0, I = 0; k < this.data.length; k += 3)
                        T[I++] = this.data[k],
                        T[I++] = this.data[k + 1],
                        T[I++] = this.data[k + 2],
                        T[I++] = 255;
                    break;
                default:
                    throw new Error(`Conversion failed due to unsupported number of channels: ${this.channels}`)
                }
                return this._update(T, this.width, this.height, 4)
            }
            putAlpha(T) {
                if (T.width !== this.width || T.height !== this.height)
                    throw new Error(`Expected mask size to be ${this.width}x${this.height}, but got ${T.width}x${T.height}`);
                if (T.channels !== 1)
                    throw new Error(`Expected mask to have 1 channel, but got ${T.channels}`);
                let k = this.data
                  , I = T.data
                  , p = this.width * this.height;
                if (this.channels === 3) {
                    let m = new Uint8ClampedArray(p * 4);
                    for (let E = 0, o = 0, d = 0; E < p; ++E)
                        m[d++] = k[o++],
                        m[d++] = k[o++],
                        m[d++] = k[o++],
                        m[d++] = I[E];
                    return this._update(m, this.width, this.height, 4)
                } else if (this.channels === 4) {
                    for (let m = 0; m < p; ++m)
                        k[4 * m + 3] = I[m];
                    return this
                }
                throw new Error(`Expected image to have 3 or 4 channels, but got ${this.channels}`)
            }
            async resize(T, k, {resample: I=2}={}) {
                if (this.width === T && this.height === k)
                    return this;
                let p = a[I] ?? I
                  , m = (0,
                l.isNullishDimension)(T)
                  , E = (0,
                l.isNullishDimension)(k);
                if (m && E)
                    return this;
                if (m ? T = k / this.height * this.width : E && (k = T / this.width * this.height),
                _) {
                    let o = this.channels
                      , d = this.toCanvas()
                      , x = M(T, k).getContext("2d");
                    return x.drawImage(d, 0, 0, T, k),
                    new g(x.getImageData(0, 0, T, k).data,T,k,4).convert(o)
                } else {
                    let o = this.toSharp();
                    switch (p) {
                    case "box":
                    case "hamming":
                        (p === "box" || p === "hamming") && (console.warn(`Resampling method ${p} is not yet supported. Using bilinear instead.`),
                        p = "bilinear");
                    case "nearest":
                    case "bilinear":
                    case "bicubic":
                        o = o.affine([T / this.width, 0, 0, k / this.height], {
                            interpolator: p
                        });
                        break;
                    case "lanczos":
                        o = o.resize({
                            width: T,
                            height: k,
                            fit: "fill",
                            kernel: "lanczos3"
                        });
                        break;
                    default:
                        throw new Error(`Resampling method ${p} is not supported.`)
                    }
                    return await L(o)
                }
            }
            async pad([T,k,I,p]) {
                if (T = Math.max(T, 0),
                k = Math.max(k, 0),
                I = Math.max(I, 0),
                p = Math.max(p, 0),
                T === 0 && k === 0 && I === 0 && p === 0)
                    return this;
                if (_) {
                    let m = this.channels
                      , E = this.toCanvas()
                      , o = this.width + T + k
                      , d = this.height + I + p
                      , x = M(o, d).getContext("2d");
                    return x.drawImage(E, 0, 0, this.width, this.height, T, I, this.width, this.height),
                    new g(x.getImageData(0, 0, o, d).data,o,d,4).convert(m)
                } else {
                    let m = this.toSharp().extend({
                        left: T,
                        right: k,
                        top: I,
                        bottom: p
                    });
                    return await L(m)
                }
            }
            async crop([T,k,I,p]) {
                if (T = Math.max(T, 0),
                k = Math.max(k, 0),
                I = Math.min(I, this.width - 1),
                p = Math.min(p, this.height - 1),
                T === 0 && k === 0 && I === this.width - 1 && p === this.height - 1)
                    return this;
                let m = I - T + 1
                  , E = p - k + 1;
                if (_) {
                    let o = this.channels
                      , d = this.toCanvas()
                      , x = M(m, E).getContext("2d");
                    return x.drawImage(d, T, k, m, E, 0, 0, m, E),
                    new g(x.getImageData(0, 0, m, E).data,m,E,4).convert(o)
                } else {
                    let o = this.toSharp().extract({
                        left: T,
                        top: k,
                        width: m,
                        height: E
                    });
                    return await L(o)
                }
            }
            async center_crop(T, k) {
                if (this.width === T && this.height === k)
                    return this;
                let I = (this.width - T) / 2
                  , p = (this.height - k) / 2;
                if (_) {
                    let m = this.channels
                      , E = this.toCanvas()
                      , o = M(T, k).getContext("2d")
                      , d = 0
                      , x = 0
                      , S = 0
                      , N = 0;
                    return I >= 0 ? d = I : S = -I,
                    p >= 0 ? x = p : N = -p,
                    o.drawImage(E, d, x, T, k, S, N, T, k),
                    new g(o.getImageData(0, 0, T, k).data,T,k,4).convert(m)
                } else {
                    let m = this.toSharp();
                    if (I >= 0 && p >= 0)
                        m = m.extract({
                            left: Math.floor(I),
                            top: Math.floor(p),
                            width: T,
                            height: k
                        });
                    else if (I <= 0 && p <= 0) {
                        let E = Math.floor(-p)
                          , o = Math.floor(-I);
                        m = m.extend({
                            top: E,
                            left: o,
                            right: T - this.width - o,
                            bottom: k - this.height - E
                        })
                    } else {
                        let E = [0, 0]
                          , o = 0;
                        p < 0 ? (E[0] = Math.floor(-p),
                        E[1] = k - this.height - E[0]) : o = Math.floor(p);
                        let d = [0, 0]
                          , x = 0;
                        I < 0 ? (d[0] = Math.floor(-I),
                        d[1] = T - this.width - d[0]) : x = Math.floor(I),
                        m = m.extend({
                            top: E[0],
                            bottom: E[1],
                            left: d[0],
                            right: d[1]
                        }).extract({
                            left: x,
                            top: o,
                            width: T,
                            height: k
                        })
                    }
                    return await L(m)
                }
            }
            async toBlob(T="image/png", k=1) {
                if (!_)
                    throw new Error("toBlob() is only supported in browser environments.");
                return await this.toCanvas().convertToBlob({
                    type: T,
                    quality: k
                })
            }
            toTensor(T="CHW") {
                let k = new R.Tensor("uint8",new Uint8Array(this.data),[this.height, this.width, this.channels]);
                if (T !== "HWC")
                    if (T === "CHW")
                        k = k.permute(2, 0, 1);
                    else
                        throw new Error(`Unsupported channel format: ${T}`);
                return k
            }
            toCanvas() {
                if (!_)
                    throw new Error("toCanvas() is only supported in browser environments.");
                let T = this.clone().rgba()
                  , k = M(T.width, T.height)
                  , I = new f(T.data,T.width,T.height);
                return k.getContext("2d").putImageData(I, 0, 0),
                k
            }
            split() {
                let {data: T, width: k, height: I, channels: p} = this
                  , m = T.constructor
                  , E = T.length / p
                  , o = Array.from({
                    length: p
                }, () => new m(E));
                for (let d = 0; d < E; ++d) {
                    let x = p * d;
                    for (let S = 0; S < p; ++S)
                        o[S][d] = T[x + S]
                }
                return o.map(d => new g(d,k,I,1))
            }
            _update(T, k, I, p=null) {
                return this.data = T,
                this.width = k,
                this.height = I,
                p !== null && (this.channels = p),
                this
            }
            clone() {
                return new g(this.data.slice(),this.width,this.height,this.channels)
            }
            convert(T) {
                if (this.channels === T)
                    return this;
                switch (T) {
                case 1:
                    this.grayscale();
                    break;
                case 3:
                    this.rgb();
                    break;
                case 4:
                    this.rgba();
                    break;
                default:
                    throw new Error(`Conversion failed due to unsupported number of channels: ${this.channels}`)
                }
                return this
            }
            async save(T) {
                if (_) {
                    if (b.apis.IS_WEBWORKER_ENV)
                        throw new Error("Unable to save an image from a Web Worker.");
                    let k = T.split(".").pop().toLowerCase()
                      , I = v.get(k) ?? "image/png"
                      , p = await this.toBlob(I);
                    (0,
                    l.saveBlob)(T, p)
                } else {
                    if (b.apis.IS_FS_AVAILABLE)
                        return await this.toSharp().toFile(T);
                    throw new Error("Unable to save the image because filesystem is disabled in this environment.")
                }
            }
            toSharp() {
                if (_)
                    throw new Error("toSharp() is only supported in server-side environments.");
                return C(this.data, {
                    raw: {
                        width: this.width,
                        height: this.height,
                        channels: this.channels
                    }
                })
            }
        }
        let y = g.read.bind(g)
    }
    ),
    "./src/utils/maths.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            FFT: () => y,
            bankers_round: () => k,
            cos_sim: () => M,
            dot: () => C,
            dynamic_time_warping: () => I,
            interpolate_data: () => l,
            log_softmax: () => R,
            magnitude: () => f,
            max: () => _,
            medianFilter: () => W,
            min: () => L,
            permute_data: () => h,
            round: () => T,
            softmax: () => b
        });
        function l(p, [m,E,o], [d,x], S="bilinear", N=!1) {
            let j = x / o
              , D = d / E
              , $ = new p.constructor(d * x * m)
              , U = E * o
              , H = d * x;
            for (let Z = 0; Z < d; ++Z)
                for (let ee = 0; ee < x; ++ee) {
                    let le = Z * x + ee
                      , we = (ee + .5) / j - .5
                      , ce = (Z + .5) / D - .5
                      , Q = Math.floor(we)
                      , A = Math.floor(ce)
                      , V = Math.min(Q + 1, o - 1)
                      , J = Math.min(A + 1, E - 1);
                    Q = Math.max(Q, 0),
                    A = Math.max(A, 0);
                    let ae = we - Q
                      , xe = ce - A
                      , be = (1 - ae) * (1 - xe)
                      , Ae = ae * (1 - xe)
                      , We = (1 - ae) * xe
                      , he = ae * xe
                      , c = A * o
                      , Y = J * o
                      , _e = c + Q
                      , ue = c + V
                      , Me = Y + Q
                      , re = Y + V;
                    for (let pe = 0; pe < m; ++pe) {
                        let se = pe * U;
                        $[pe * H + le] = be * p[se + _e] + Ae * p[se + ue] + We * p[se + Me] + he * p[se + re]
                    }
                }
            return $
        }
        function h(p, m, E) {
            let o = new Array(E.length)
              , d = new Array(E.length);
            for (let N = E.length - 1, j = 1; N >= 0; --N)
                d[N] = j,
                o[N] = m[E[N]],
                j *= o[N];
            let x = E.map( (N, j) => d[E.indexOf(j)])
              , S = new p.constructor(p.length);
            for (let N = 0; N < p.length; ++N) {
                let j = 0;
                for (let D = m.length - 1, $ = N; D >= 0; --D)
                    j += $ % m[D] * x[D],
                    $ = Math.floor($ / m[D]);
                S[j] = p[N]
            }
            return [S, o]
        }
        function b(p) {
            let m = _(p)[0]
              , E = p.map(x => Math.exp(x - m))
              , o = E.reduce( (x, S) => x + S, 0);
            return E.map(x => x / o)
        }
        function R(p) {
            let m = _(p)[0]
              , E = 0;
            for (let x = 0; x < p.length; ++x)
                E += Math.exp(p[x] - m);
            let o = Math.log(E);
            return p.map(x => x - m - o)
        }
        function C(p, m) {
            let E = 0;
            for (let o = 0; o < p.length; ++o)
                E += p[o] * m[o];
            return E
        }
        function M(p, m) {
            let E = C(p, m)
              , o = f(p)
              , d = f(m);
            return E / (o * d)
        }
        function f(p) {
            return Math.sqrt(p.reduce( (m, E) => m + E * E, 0))
        }
        function L(p) {
            if (p.length === 0)
                throw Error("Array must not be empty");
            let m = p[0]
              , E = 0;
            for (let o = 1; o < p.length; ++o)
                p[o] < m && (m = p[o],
                E = o);
            return [m, E]
        }
        function _(p) {
            if (p.length === 0)
                throw Error("Array must not be empty");
            let m = p[0]
              , E = 0;
            for (let o = 1; o < p.length; ++o)
                p[o] > m && (m = p[o],
                E = o);
            return [m, E]
        }
        function a(p) {
            return p > 0 && (p & p - 1) === 0
        }
        class v {
            constructor(m) {
                if (this.size = m | 0,
                this.size <= 1 || !a(this.size))
                    throw new Error("FFT size must be a power of two larger than 1");
                this._csize = m << 1,
                this.table = new Float64Array(this.size * 2);
                for (let o = 0; o < this.table.length; o += 2) {
                    let d = Math.PI * o / this.size;
                    this.table[o] = Math.cos(d),
                    this.table[o + 1] = -Math.sin(d)
                }
                let E = 0;
                for (let o = 1; this.size > o; o <<= 1)
                    ++E;
                this._width = E % 2 === 0 ? E - 1 : E,
                this._bitrev = new Int32Array(1 << this._width);
                for (let o = 0; o < this._bitrev.length; ++o) {
                    this._bitrev[o] = 0;
                    for (let d = 0; d < this._width; d += 2) {
                        let x = this._width - d - 2;
                        this._bitrev[o] |= (o >>> d & 3) << x
                    }
                }
            }
            createComplexArray() {
                return new Float64Array(this._csize)
            }
            fromComplexArray(m, E) {
                let o = E || new Array(m.length >>> 1);
                for (let d = 0; d < m.length; d += 2)
                    o[d >>> 1] = m[d];
                return o
            }
            toComplexArray(m, E) {
                let o = E || this.createComplexArray();
                for (let d = 0; d < o.length; d += 2)
                    o[d] = m[d >>> 1],
                    o[d + 1] = 0;
                return o
            }
            transform(m, E) {
                if (m === E)
                    throw new Error("Input and output buffers must be different");
                this._transform4(m, E, 1)
            }
            realTransform(m, E) {
                if (m === E)
                    throw new Error("Input and output buffers must be different");
                this._realTransform4(m, E, 1)
            }
            inverseTransform(m, E) {
                if (m === E)
                    throw new Error("Input and output buffers must be different");
                this._transform4(m, E, -1);
                for (let o = 0; o < m.length; ++o)
                    m[o] /= this.size
            }
            _transform4(m, E, o) {
                let d = this._csize, S = 1 << this._width, N = d / S << 1, j, D, $ = this._bitrev;
                if (N === 4)
                    for (j = 0,
                    D = 0; j < d; j += N,
                    ++D) {
                        let H = $[D];
                        this._singleTransform2(E, m, j, H, S)
                    }
                else
                    for (j = 0,
                    D = 0; j < d; j += N,
                    ++D) {
                        let H = $[D];
                        this._singleTransform4(E, m, j, H, S, o)
                    }
                let U = this.table;
                for (S >>= 2; S >= 2; S >>= 2) {
                    N = d / S << 1;
                    let H = N >>> 2;
                    for (j = 0; j < d; j += N) {
                        let Z = j + H - 1;
                        for (let ee = j, le = 0; ee < Z; ee += 2,
                        le += S) {
                            let we = ee
                              , ce = we + H
                              , Q = ce + H
                              , A = Q + H
                              , V = m[we]
                              , J = m[we + 1]
                              , ae = m[ce]
                              , xe = m[ce + 1]
                              , be = m[Q]
                              , Ae = m[Q + 1]
                              , We = m[A]
                              , he = m[A + 1]
                              , c = U[le]
                              , Y = o * U[le + 1]
                              , _e = ae * c - xe * Y
                              , ue = ae * Y + xe * c
                              , Me = U[2 * le]
                              , re = o * U[2 * le + 1]
                              , pe = be * Me - Ae * re
                              , se = be * re + Ae * Me
                              , Te = U[3 * le]
                              , Ee = o * U[3 * le + 1]
                              , ye = We * Te - he * Ee
                              , Pe = We * Ee + he * Te
                              , Se = V + pe
                              , De = J + se
                              , Ve = V - pe
                              , Re = J - se
                              , $e = _e + ye
                              , ze = ue + Pe
                              , Ze = o * (_e - ye)
                              , Ie = o * (ue - Pe);
                            m[we] = Se + $e,
                            m[we + 1] = De + ze,
                            m[ce] = Ve + Ie,
                            m[ce + 1] = Re - Ze,
                            m[Q] = Se - $e,
                            m[Q + 1] = De - ze,
                            m[A] = Ve - Ie,
                            m[A + 1] = Re + Ze
                        }
                    }
                }
            }
            _singleTransform2(m, E, o, d, x) {
                let S = m[d]
                  , N = m[d + 1]
                  , j = m[d + x]
                  , D = m[d + x + 1];
                E[o] = S + j,
                E[o + 1] = N + D,
                E[o + 2] = S - j,
                E[o + 3] = N - D
            }
            _singleTransform4(m, E, o, d, x, S) {
                let N = x * 2
                  , j = x * 3
                  , D = m[d]
                  , $ = m[d + 1]
                  , U = m[d + x]
                  , H = m[d + x + 1]
                  , Z = m[d + N]
                  , ee = m[d + N + 1]
                  , le = m[d + j]
                  , we = m[d + j + 1]
                  , ce = D + Z
                  , Q = $ + ee
                  , A = D - Z
                  , V = $ - ee
                  , J = U + le
                  , ae = H + we
                  , xe = S * (U - le)
                  , be = S * (H - we);
                E[o] = ce + J,
                E[o + 1] = Q + ae,
                E[o + 2] = A + be,
                E[o + 3] = V - xe,
                E[o + 4] = ce - J,
                E[o + 5] = Q - ae,
                E[o + 6] = A - be,
                E[o + 7] = V + xe
            }
            _realTransform4(m, E, o) {
                let d = this._csize, S = 1 << this._width, N = d / S << 1, j, D, $ = this._bitrev;
                if (N === 4)
                    for (j = 0,
                    D = 0; j < d; j += N,
                    ++D) {
                        let Z = $[D];
                        this._singleRealTransform2(E, m, j, Z >>> 1, S >>> 1)
                    }
                else
                    for (j = 0,
                    D = 0; j < d; j += N,
                    ++D) {
                        let Z = $[D];
                        this._singleRealTransform4(E, m, j, Z >>> 1, S >>> 1, o)
                    }
                let U = this.table;
                for (S >>= 2; S >= 2; S >>= 2) {
                    N = d / S << 1;
                    let Z = N >>> 1
                      , ee = Z >>> 1
                      , le = ee >>> 1;
                    for (j = 0; j < d; j += N)
                        for (let we = 0, ce = 0; we <= le; we += 2,
                        ce += S) {
                            let Q = j + we
                              , A = Q + ee
                              , V = A + ee
                              , J = V + ee
                              , ae = m[Q]
                              , xe = m[Q + 1]
                              , be = m[A]
                              , Ae = m[A + 1]
                              , We = m[V]
                              , he = m[V + 1]
                              , c = m[J]
                              , Y = m[J + 1]
                              , _e = ae
                              , ue = xe
                              , Me = U[ce]
                              , re = o * U[ce + 1]
                              , pe = be * Me - Ae * re
                              , se = be * re + Ae * Me
                              , Te = U[2 * ce]
                              , Ee = o * U[2 * ce + 1]
                              , ye = We * Te - he * Ee
                              , Pe = We * Ee + he * Te
                              , Se = U[3 * ce]
                              , De = o * U[3 * ce + 1]
                              , Ve = c * Se - Y * De
                              , Re = c * De + Y * Se
                              , $e = _e + ye
                              , ze = ue + Pe
                              , Ze = _e - ye
                              , Ie = ue - Pe
                              , st = pe + Ve
                              , qe = se + Re
                              , ht = o * (pe - Ve)
                              , Kt = o * (se - Re);
                            if (m[Q] = $e + st,
                            m[Q + 1] = ze + qe,
                            m[A] = Ze + Kt,
                            m[A + 1] = Ie - ht,
                            we === 0) {
                                m[V] = $e - st,
                                m[V + 1] = ze - qe;
                                continue
                            }
                            if (we === le)
                                continue;
                            let Zt = j + ee - we
                              , Gt = j + Z - we;
                            m[Zt] = Ze - o * Kt,
                            m[Zt + 1] = -Ie - o * ht,
                            m[Gt] = $e - o * st,
                            m[Gt + 1] = -ze + o * qe
                        }
                }
                let H = d >>> 1;
                for (let Z = 2; Z < H; Z += 2)
                    m[d - Z] = m[Z],
                    m[d - Z + 1] = -m[Z + 1]
            }
            _singleRealTransform2(m, E, o, d, x) {
                let S = m[d]
                  , N = m[d + x];
                E[o] = S + N,
                E[o + 1] = 0,
                E[o + 2] = S - N,
                E[o + 3] = 0
            }
            _singleRealTransform4(m, E, o, d, x, S) {
                let N = x * 2
                  , j = x * 3
                  , D = m[d]
                  , $ = m[d + x]
                  , U = m[d + N]
                  , H = m[d + j]
                  , Z = D + U
                  , ee = D - U
                  , le = $ + H
                  , we = S * ($ - H);
                E[o] = Z + le,
                E[o + 1] = 0,
                E[o + 2] = ee,
                E[o + 3] = -we,
                E[o + 4] = Z - le,
                E[o + 5] = 0,
                E[o + 6] = ee,
                E[o + 7] = we
            }
        }
        class g {
            constructor(m) {
                let E = 2 * (m - 1)
                  , o = 2 * (2 * m - 1)
                  , d = 2 ** Math.ceil(Math.log2(o));
                this.bufferSize = d,
                this._a = E;
                let x = new Float64Array(o)
                  , S = new Float64Array(d);
                this._chirpBuffer = new Float64Array(d),
                this._buffer1 = new Float64Array(d),
                this._buffer2 = new Float64Array(d),
                this._outBuffer1 = new Float64Array(d),
                this._outBuffer2 = new Float64Array(d);
                let N = -2 * Math.PI / m
                  , j = Math.cos(N)
                  , D = Math.sin(N);
                for (let $ = 0; $ < o >> 1; ++$) {
                    let U = ($ + 1 - m) ** 2 / 2
                      , H = Math.sqrt(j ** 2 + D ** 2) ** U
                      , Z = U * Math.atan2(D, j)
                      , ee = 2 * $;
                    x[ee] = H * Math.cos(Z),
                    x[ee + 1] = H * Math.sin(Z),
                    S[ee] = x[ee],
                    S[ee + 1] = -x[ee + 1]
                }
                this._slicedChirpBuffer = x.subarray(E, o),
                this._f = new v(d >> 1),
                this._f.transform(this._chirpBuffer, S)
            }
            _transform(m, E, o) {
                let d = this._buffer1
                  , x = this._buffer2
                  , S = this._outBuffer1
                  , N = this._outBuffer2
                  , j = this._chirpBuffer
                  , D = this._slicedChirpBuffer
                  , $ = this._a;
                if (o)
                    for (let U = 0; U < D.length; U += 2) {
                        let H = U + 1
                          , Z = U >> 1
                          , ee = E[Z];
                        d[U] = ee * D[U],
                        d[H] = ee * D[H]
                    }
                else
                    for (let U = 0; U < D.length; U += 2) {
                        let H = U + 1;
                        d[U] = E[U] * D[U] - E[H] * D[H],
                        d[H] = E[U] * D[H] + E[H] * D[U]
                    }
                this._f.transform(S, d);
                for (let U = 0; U < j.length; U += 2) {
                    let H = U + 1;
                    x[U] = S[U] * j[U] - S[H] * j[H],
                    x[H] = S[U] * j[H] + S[H] * j[U]
                }
                this._f.inverseTransform(N, x);
                for (let U = 0; U < N.length; U += 2) {
                    let H = N[U + $]
                      , Z = N[U + $ + 1]
                      , ee = D[U]
                      , le = D[U + 1];
                    m[U] = H * ee - Z * le,
                    m[U + 1] = H * le + Z * ee
                }
            }
            transform(m, E) {
                this._transform(m, E, !1)
            }
            realTransform(m, E) {
                this._transform(m, E, !0)
            }
        }
        class y {
            constructor(m) {
                this.fft_length = m,
                this.isPowerOfTwo = a(m),
                this.isPowerOfTwo ? (this.fft = new v(m),
                this.outputBufferSize = 2 * m) : (this.fft = new g(m),
                this.outputBufferSize = this.fft.bufferSize)
            }
            realTransform(m, E) {
                this.fft.realTransform(m, E)
            }
            transform(m, E) {
                this.fft.transform(m, E)
            }
        }
        function W(p, m) {
            if (m % 2 === 0 || m <= 0)
                throw new Error("Window size must be a positive odd number");
            let E = new p.constructor(p.length)
              , o = new p.constructor(m)
              , d = Math.floor(m / 2);
            for (let x = 0; x < p.length; ++x) {
                let S = 0;
                for (let N = -d; N <= d; ++N) {
                    let j = x + N;
                    j < 0 ? j = Math.abs(j) : j >= p.length && (j = 2 * (p.length - 1) - j),
                    o[S++] = p[j]
                }
                o.sort(),
                E[x] = o[d]
            }
            return E
        }
        function T(p, m) {
            let E = Math.pow(10, m);
            return Math.round(p * E) / E
        }
        function k(p) {
            let m = Math.round(p);
            return Math.abs(p) % 1 === .5 ? m % 2 === 0 ? m : m - 1 : m
        }
        function I(p) {
            let m = p.length
              , E = p[0].length
              , o = [m + 1, E + 1]
              , d = Array.from({
                length: o[0]
            }, () => Array(o[1]).fill(1 / 0));
            d[0][0] = 0;
            let x = Array.from({
                length: o[0]
            }, () => Array(o[1]).fill(-1));
            for (let $ = 1; $ < o[1]; ++$)
                for (let U = 1; U < o[0]; ++U) {
                    let H = d[U - 1][$ - 1], Z = d[U - 1][$], ee = d[U][$ - 1], le, we;
                    H < Z && H < ee ? (le = H,
                    we = 0) : Z < H && Z < ee ? (le = Z,
                    we = 1) : (le = ee,
                    we = 2),
                    d[U][$] = p[U - 1][$ - 1] + le,
                    x[U][$] = we
                }
            for (let $ = 0; $ < o[1]; ++$)
                x[0][$] = 2;
            for (let $ = 0; $ < o[0]; ++$)
                x[$][0] = 1;
            let S = m
              , N = E
              , j = []
              , D = [];
            for (; S > 0 || N > 0; )
                switch (j.push(S - 1),
                D.push(N - 1),
                x[S][N]) {
                case 0:
                    --S,
                    --N;
                    break;
                case 1:
                    --S;
                    break;
                case 2:
                    --N;
                    break;
                default:
                    throw new Error(`Internal error in dynamic time warping. Unexpected trace[${S}, ${N}]. Please file a bug report.`)
                }
            return j.reverse(),
            D.reverse(),
            [j, D]
        }
    }
    ),
    "./src/utils/tensor.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            DataTypeMap: () => R,
            Tensor: () => C,
            cat: () => E,
            full: () => D,
            full_like: () => $,
            interpolate: () => L,
            interpolate_4d: () => _,
            layer_norm: () => k,
            matmul: () => a,
            mean: () => S,
            mean_pooling: () => T,
            ones: () => U,
            ones_like: () => H,
            permute: () => f,
            quantize_embeddings: () => ce,
            rand: () => le,
            randn: () => we,
            rfft: () => v,
            slice: () => W,
            stack: () => o,
            std_mean: () => x,
            topk: () => g,
            zeros: () => Z,
            zeros_like: () => ee
        });
        var l = e("./src/utils/maths.js")
          , h = e("./src/backends/onnx.js")
          , b = e("./src/ops/registry.js");
        let R = Object.freeze({
            float32: Float32Array,
            float16: typeof Float16Array < "u" ? Float16Array : Uint16Array,
            float64: Float64Array,
            string: Array,
            int8: Int8Array,
            uint8: Uint8Array,
            int16: Int16Array,
            uint16: Uint16Array,
            int32: Int32Array,
            uint32: Uint32Array,
            int64: BigInt64Array,
            uint64: BigUint64Array,
            bool: Uint8Array,
            uint4: Uint8Array,
            int4: Int8Array
        });
        class C {
            get dims() {
                return this.ort_tensor.dims
            }
            set dims(A) {
                this.ort_tensor.dims = A
            }
            get type() {
                return this.ort_tensor.type
            }
            get data() {
                return this.ort_tensor.data
            }
            get size() {
                return this.ort_tensor.size
            }
            get location() {
                return this.ort_tensor.location
            }
            ort_tensor;
            constructor(...A) {
                return (0,
                h.isONNXTensor)(A[0]) ? this.ort_tensor = A[0] : this.ort_tensor = new h.Tensor(A[0],A[1],A[2]),
                new Proxy(this,{
                    get: (V, J) => {
                        if (typeof J == "string") {
                            let ae = Number(J);
                            if (Number.isInteger(ae))
                                return V._getitem(ae)
                        }
                        return V[J]
                    }
                    ,
                    set: (V, J, ae) => V[J] = ae
                })
            }
            dispose() {
                this.ort_tensor.dispose()
            }
            *[Symbol.iterator]() {
                let[A,...V] = this.dims;
                if (V.length > 0) {
                    let J = V.reduce( (ae, xe) => ae * xe);
                    for (let ae = 0; ae < A; ++ae)
                        yield this._subarray(ae, J, V)
                } else
                    yield*this.data
            }
            _getitem(A) {
                let[V,...J] = this.dims;
                if (A = m(A, V),
                J.length > 0) {
                    let ae = J.reduce( (xe, be) => xe * be);
                    return this._subarray(A, ae, J)
                } else
                    return new C(this.type,[this.data[A]],J)
            }
            indexOf(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    if (V[J] == A)
                        return J;
                return -1
            }
            _subarray(A, V, J) {
                let ae = A * V
                  , xe = (A + 1) * V
                  , be = "subarray"in this.data ? this.data.subarray(ae, xe) : this.data.slice(ae, xe);
                return new C(this.type,be,J)
            }
            item() {
                let A = this.data;
                if (A.length !== 1)
                    throw new Error(`a Tensor with ${A.length} elements cannot be converted to Scalar`);
                return A[0]
            }
            tolist() {
                return M(this.data, this.dims)
            }
            sigmoid() {
                return this.clone().sigmoid_()
            }
            sigmoid_() {
                let A = this.data;
                for (let V = 0; V < A.length; ++V)
                    A[V] = 1 / (1 + Math.exp(-A[V]));
                return this
            }
            map(A) {
                return this.clone().map_(A)
            }
            map_(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    V[J] = A(V[J], J, V);
                return this
            }
            mul(A) {
                return this.clone().mul_(A)
            }
            mul_(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    V[J] *= A;
                return this
            }
            div(A) {
                return this.clone().div_(A)
            }
            div_(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    V[J] /= A;
                return this
            }
            add(A) {
                return this.clone().add_(A)
            }
            add_(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    V[J] += A;
                return this
            }
            sub(A) {
                return this.clone().sub_(A)
            }
            sub_(A) {
                let V = this.data;
                for (let J = 0; J < V.length; ++J)
                    V[J] -= A;
                return this
            }
            clone() {
                return new C(this.type,this.data.slice(),this.dims.slice())
            }
            slice(...A) {
                let V = []
                  , J = [];
                for (let c = 0; c < this.dims.length; ++c) {
                    let Y = A[c];
                    if (Y == null)
                        J.push([0, this.dims[c]]),
                        V.push(this.dims[c]);
                    else if (typeof Y == "number")
                        Y = m(Y, this.dims[c], c),
                        J.push([Y, Y + 1]);
                    else if (Array.isArray(Y) && Y.length === 2) {
                        let[_e,ue] = Y;
                        if (_e = _e === null ? 0 : m(_e, this.dims[c], c, !1),
                        ue = ue === null ? this.dims[c] : m(ue, this.dims[c], c, !1),
                        _e > ue)
                            throw new Error(`Invalid slice: ${Y}`);
                        let Me = [Math.max(_e, 0), Math.min(ue, this.dims[c])];
                        J.push(Me),
                        V.push(Me[1] - Me[0])
                    } else
                        throw new Error(`Invalid slice: ${Y}`)
                }
                let ae = J.map( ([c,Y]) => Y - c)
                  , xe = ae.reduce( (c, Y) => c * Y)
                  , be = this.data
                  , Ae = new be.constructor(xe)
                  , We = this.stride()
                  , he = !0;
                for (let c = 1; c < ae.length; ++c)
                    if (J[c][0] !== 0 || J[c][1] !== this.dims[c]) {
                        he = !1;
                        break
                    }
                if (he) {
                    let c = J[0][0] * We[0]
                      , Y = J[0][1] * We[0];
                    if (ArrayBuffer.isView(be))
                        Ae.set(be.subarray(c, Y));
                    else if (Array.isArray(be)) {
                        let _e = be.slice(c, Y);
                        for (let ue = 0; ue < _e.length; ++ue)
                            Ae[ue] = _e[ue]
                    } else
                        throw new Error("Unsupported data type for slicing")
                } else
                    for (let c = 0; c < xe; ++c) {
                        let Y = 0;
                        for (let _e = ae.length - 1, ue = c; _e >= 0; --_e) {
                            let Me = ae[_e];
                            Y += (ue % Me + J[_e][0]) * We[_e],
                            ue = Math.floor(ue / Me)
                        }
                        Ae[c] = be[Y]
                    }
                return new C(this.type,Ae,V)
            }
            permute(...A) {
                return f(this, A)
            }
            transpose(...A) {
                return this.permute(...A)
            }
            sum(A=null, V=!1) {
                return this.norm(1, A, V)
            }
            norm(A="fro", V=null, J=!1) {
                if (A === "fro")
                    A = 2;
                else if (typeof A == "string")
                    throw Error(`Unsupported norm: ${A}`);
                let ae = this.data
                  , xe = (he, c) => he + c ** A;
                if (V === null) {
                    let he = ae.reduce(xe, 0) ** (1 / A);
                    return new C(this.type,[he],[])
                }
                let[be,Ae,We] = d(xe, this, V, J);
                if (A !== 1)
                    for (let he = 0; he < Ae.length; ++he)
                        Ae[he] = Ae[he] ** (1 / A);
                return new C(be,Ae,We)
            }
            normalize_(A=2, V=1) {
                V = m(V, this.dims.length);
                let J = this.norm(A, V, !0)
                  , ae = this.data
                  , xe = J.data;
                for (let be = 0; be < ae.length; ++be) {
                    let Ae = 0;
                    for (let We = this.dims.length - 1, he = be, c = 1; We >= 0; --We) {
                        let Y = this.dims[We];
                        if (We !== V) {
                            let _e = he % Y;
                            Ae += _e * c,
                            c *= this.dims[We]
                        }
                        he = Math.floor(he / Y)
                    }
                    ae[be] /= xe[Ae]
                }
                return this
            }
            normalize(A=2, V=1) {
                return this.clone().normalize_(A, V)
            }
            stride() {
                return N(this.dims)
            }
            squeeze(A=null) {
                return new C(this.type,this.data,I(this.dims, A))
            }
            squeeze_(A=null) {
                return this.dims = I(this.dims, A),
                this
            }
            unsqueeze(A=null) {
                return new C(this.type,this.data,p(this.dims, A))
            }
            unsqueeze_(A=null) {
                return this.dims = p(this.dims, A),
                this
            }
            flatten_(A=0, V=-1) {
                V = (V + this.dims.length) % this.dims.length;
                let J = this.dims.slice(0, A)
                  , ae = this.dims.slice(A, V + 1)
                  , xe = this.dims.slice(V + 1);
                return this.dims = [...J, ae.reduce( (be, Ae) => be * Ae, 1), ...xe],
                this
            }
            flatten(A=0, V=-1) {
                return this.clone().flatten_(A, V)
            }
            view(...A) {
                let V = -1;
                for (let ae = 0; ae < A.length; ++ae)
                    if (A[ae] === -1) {
                        if (V !== -1)
                            throw new Error("Only one dimension can be inferred");
                        V = ae
                    }
                let J = this.data;
                if (V !== -1) {
                    let ae = A.reduce( (xe, be, Ae) => Ae !== V ? xe * be : xe, 1);
                    A[V] = J.length / ae
                }
                return new C(this.type,J,A)
            }
            neg_() {
                let A = this.data;
                for (let V = 0; V < A.length; ++V)
                    A[V] = -A[V];
                return this
            }
            neg() {
                return this.clone().neg_()
            }
            gt(A) {
                let V = new Uint8Array(this.data.length)
                  , J = this.data;
                for (let ae = 0; ae < J.length; ++ae)
                    V[ae] = J[ae] > A ? 1 : 0;
                return new C("bool",V,this.dims)
            }
            lt(A) {
                let V = new Uint8Array(this.data.length)
                  , J = this.data;
                for (let ae = 0; ae < J.length; ++ae)
                    V[ae] = J[ae] < A ? 1 : 0;
                return new C("bool",V,this.dims)
            }
            clamp_(A, V) {
                let J = this.data;
                for (let ae = 0; ae < J.length; ++ae)
                    J[ae] = Math.min(Math.max(J[ae], A), V);
                return this
            }
            clamp(A, V) {
                return this.clone().clamp_(A, V)
            }
            round_() {
                let A = this.data;
                for (let V = 0; V < A.length; ++V)
                    A[V] = Math.round(A[V]);
                return this
            }
            round() {
                return this.clone().round_()
            }
            mean(A=null, V=!1) {
                return S(this, A, V)
            }
            min(A=null, V=!1) {
                if (A === null) {
                    let be = (0,
                    l.min)(this.data)[0];
                    return new C(this.type,[be],[])
                }
                let[J,ae,xe] = d( (be, Ae) => Math.min(be, Ae), this, A, V, 1 / 0);
                return new C(J,ae,xe)
            }
            max(A=null, V=!1) {
                if (A === null) {
                    let be = (0,
                    l.max)(this.data)[0];
                    return new C(this.type,[be],[])
                }
                let[J,ae,xe] = d( (be, Ae) => Math.max(be, Ae), this, A, V, -1 / 0);
                return new C(J,ae,xe)
            }
            argmin(A=null, V=!1) {
                if (A !== null)
                    throw new Error("`dim !== null` not yet implemented.");
                let J = (0,
                l.min)(this.data)[1];
                return new C("int64",[BigInt(J)],[])
            }
            argmax(A=null, V=!1) {
                if (A !== null)
                    throw new Error("`dim !== null` not yet implemented.");
                let J = (0,
                l.max)(this.data)[1];
                return new C("int64",[BigInt(J)],[])
            }
            to(A) {
                if (this.type === A)
                    return this;
                if (!R.hasOwnProperty(A))
                    throw new Error(`Unsupported type: ${A}`);
                let V, J = ["int64", "uint64"].includes(this.type), ae = ["int64", "uint64"].includes(A);
                return J && !ae ? V = Number : !J && ae && (["float16", "float32", "float64"].includes(this.type) ? V = xe => BigInt(Math.floor(xe)) : V = BigInt),
                new C(A,R[A].from(this.data, V),this.dims)
            }
        }
        function M(Q, A) {
            let V = Q.length
              , J = A.reduce( (xe, be) => xe * be);
            if (V !== J)
                throw Error(`cannot reshape array of size ${V} into shape (${A})`);
            let ae = Q;
            for (let xe = A.length - 1; xe >= 0; xe--)
                ae = ae.reduce( (be, Ae) => {
                    let We = be[be.length - 1];
                    return We.length < A[xe] ? We.push(Ae) : be.push([Ae]),
                    be
                }
                , [[]]);
            return ae[0]
        }
        function f(Q, A) {
            let[V,J] = (0,
            l.permute_data)(Q.data, Q.dims, A);
            return new C(Q.type,V,J)
        }
        function L(Q, [A,V], J="bilinear", ae=!1) {
            let xe = Q.dims.at(-3) ?? 1
              , be = Q.dims.at(-2)
              , Ae = Q.dims.at(-1)
              , We = (0,
            l.interpolate_data)(Q.data, [xe, be, Ae], [A, V], J, ae);
            return new C(Q.type,We,[xe, A, V])
        }
        async function _(Q, {size: A=null, mode: V="bilinear"}={}) {
            if (Q.dims.length !== 4)
                throw new Error("`interpolate_4d` currently only supports 4D input.");
            if (!A)
                throw new Error("`interpolate_4d` requires a `size` argument.");
            let J;
            if (A.length === 2)
                J = [...Q.dims.slice(0, 2), ...A];
            else if (A.length === 3)
                J = [Q.dims[0], ...A];
            else if (A.length === 4)
                J = A;
            else
                throw new Error("`size` must be of length 2, 3, or 4.");
            let ae;
            if (V === "nearest")
                ae = await b.TensorOpRegistry.nearest_interpolate_4d;
            else if (V === "bilinear")
                ae = await b.TensorOpRegistry.bilinear_interpolate_4d;
            else if (V === "bicubic")
                ae = await b.TensorOpRegistry.bicubic_interpolate_4d;
            else
                throw new Error(`Unsupported mode: ${V}`);
            let xe = new C("int64",new BigInt64Array(J.map(BigInt)),[J.length]);
            return await ae({
                x: Q,
                s: xe
            })
        }
        async function a(Q, A) {
            return await (await b.TensorOpRegistry.matmul)({
                a: Q,
                b: A
            })
        }
        async function v(Q, A) {
            return await (await b.TensorOpRegistry.rfft)({
                x: Q,
                a: A
            })
        }
        async function g(Q, A) {
            let V = await b.TensorOpRegistry.top_k;
            return A == null ? A = Q.dims.at(-1) : A = Math.min(A, Q.dims.at(-1)),
            await V({
                x: Q,
                k: new C("int64",[BigInt(A)],[1])
            })
        }
        let y = Q => new C("int64",Q,[Q.length]);
        async function W(Q, A, V, J, ae) {
            return await (await b.TensorOpRegistry.slice)({
                x: Q,
                s: y(A),
                e: y(V),
                a: y(J),
                t: y(ae ?? new Array(J.length).fill(1))
            })
        }
        function T(Q, A) {
            let V = Q.data
              , J = A.data
              , ae = [Q.dims[0], Q.dims[2]]
              , xe = new V.constructor(ae[0] * ae[1])
              , [be,Ae,We] = Q.dims
              , he = 0;
            for (let c = 0; c < be; ++c) {
                let Y = c * We * Ae;
                for (let _e = 0; _e < We; ++_e) {
                    let ue = 0
                      , Me = 0
                      , re = c * Ae
                      , pe = Y + _e;
                    for (let Te = 0; Te < Ae; ++Te) {
                        let Ee = Number(J[re + Te]);
                        Me += Ee,
                        ue += V[pe + Te * We] * Ee
                    }
                    let se = ue / Me;
                    xe[he++] = se
                }
            }
            return new C(Q.type,xe,ae)
        }
        function k(Q, A, {eps: V=1e-5}={}) {
            if (Q.dims.length !== 2)
                throw new Error("`layer_norm` currently only supports 2D input.");
            let[J,ae] = Q.dims;
            if (A.length !== 1 && A[0] !== ae)
                throw new Error("`normalized_shape` must be a 1D array with shape `[input.dims[1]]`.");
            let[xe,be] = x(Q, 1, 0, !0)
              , Ae = xe.data
              , We = be.data
              , he = Q.data
              , c = new he.constructor(he.length);
            for (let Y = 0; Y < J; ++Y) {
                let _e = Y * ae;
                for (let ue = 0; ue < ae; ++ue) {
                    let Me = _e + ue;
                    c[Me] = (he[Me] - We[Y]) / (Ae[Y] + V)
                }
            }
            return new C(Q.type,c,Q.dims)
        }
        function I(Q, A) {
            return Q = Q.slice(),
            A === null ? Q = Q.filter(V => V !== 1) : typeof A == "number" ? Q[A] === 1 && Q.splice(A, 1) : Array.isArray(A) && (Q = Q.filter( (V, J) => V !== 1 || !A.includes(J))),
            Q
        }
        function p(Q, A) {
            return A = m(A, Q.length + 1),
            Q = Q.slice(),
            Q.splice(A, 0, 1),
            Q
        }
        function m(Q, A, V=null, J=!0) {
            if (Q < -A || Q >= A) {
                if (J)
                    throw new Error(`IndexError: index ${Q} is out of bounds for dimension${V === null ? "" : " " + V} with size ${A}`);
                return Q < -A ? 0 : A
            }
            return Q < 0 && (Q = (Q % A + A) % A),
            Q
        }
        function E(Q, A=0) {
            A = m(A, Q[0].dims.length);
            let V = Q[0].dims.slice();
            V[A] = Q.reduce( (be, Ae) => be + Ae.dims[A], 0);
            let J = V.reduce( (be, Ae) => be * Ae, 1)
              , ae = new Q[0].data.constructor(J)
              , xe = Q[0].type;
            if (A === 0) {
                let be = 0;
                for (let Ae of Q) {
                    let We = Ae.data;
                    ae.set(We, be),
                    be += We.length
                }
            } else {
                let be = 0;
                for (let Ae = 0; Ae < Q.length; ++Ae) {
                    let {data: We, dims: he} = Q[Ae];
                    for (let c = 0; c < We.length; ++c) {
                        let Y = 0;
                        for (let _e = he.length - 1, ue = c, Me = 1; _e >= 0; --_e) {
                            let re = he[_e]
                              , pe = ue % re;
                            _e === A && (pe += be),
                            Y += pe * Me,
                            Me *= V[_e],
                            ue = Math.floor(ue / re)
                        }
                        ae[Y] = We[c]
                    }
                    be += he[A]
                }
            }
            return new C(xe,ae,V)
        }
        function o(Q, A=0) {
            return E(Q.map(V => V.unsqueeze(A)), A)
        }
        function d(Q, A, V=null, J=!1, ae=null) {
            let xe = A.data
              , be = A.dims;
            V = m(V, be.length);
            let Ae = be.slice();
            Ae[V] = 1;
            let We = new xe.constructor(xe.length / be[V]);
            ae !== null && We.fill(ae);
            for (let he = 0; he < xe.length; ++he) {
                let c = 0;
                for (let Y = be.length - 1, _e = he, ue = 1; Y >= 0; --Y) {
                    let Me = be[Y];
                    if (Y !== V) {
                        let re = _e % Me;
                        c += re * ue,
                        ue *= Ae[Y]
                    }
                    _e = Math.floor(_e / Me)
                }
                We[c] = Q(We[c], xe[he], he, c)
            }
            return J || Ae.splice(V, 1),
            [A.type, We, Ae]
        }
        function x(Q, A=null, V=1, J=!1) {
            let ae = Q.data
              , xe = Q.dims;
            if (A === null) {
                let ue = ae.reduce( (se, Te) => se + Te, 0) / ae.length
                  , Me = Math.sqrt(ae.reduce( (se, Te) => se + (Te - ue) ** 2, 0) / (ae.length - V))
                  , re = new C(Q.type,[ue],[]);
                return [new C(Q.type,[Me],[]), re]
            }
            A = m(A, xe.length);
            let be = S(Q, A, J)
              , Ae = be.data
              , [We,he,c] = d( (_e, ue, Me, re) => _e + (ue - Ae[re]) ** 2, Q, A, J);
            for (let _e = 0; _e < he.length; ++_e)
                he[_e] = Math.sqrt(he[_e] / (xe[A] - V));
            return [new C(We,he,c), be]
        }
        function S(Q, A=null, V=!1) {
            let J = Q.dims
              , ae = Q.data;
            if (A === null) {
                let We = ae.reduce( (he, c) => he + c, 0);
                return new C(Q.type,[We / ae.length],[])
            }
            A = m(A, J.length);
            let[xe,be,Ae] = d( (We, he) => We + he, Q, A, V);
            if (J[A] !== 1)
                for (let We = 0; We < be.length; ++We)
                    be[We] /= J[A];
            return new C(xe,be,Ae)
        }
        function N(Q) {
            let A = new Array(Q.length);
            for (let V = Q.length - 1, J = 1; V >= 0; --V)
                A[V] = J,
                J *= Q[V];
            return A
        }
        function j(Q, A, V, J) {
            let ae = Q.reduce( (xe, be) => xe * be, 1);
            return new C(V,new J(ae).fill(A),Q)
        }
        function D(Q, A) {
            let V, J;
            if (typeof A == "number")
                V = "float32",
                J = Float32Array;
            else if (typeof A == "bigint")
                V = "int64",
                J = BigInt64Array;
            else if (typeof A == "boolean")
                V = "bool",
                J = Uint8Array;
            else
                throw new Error(`Unsupported data type: ${typeof A}`);
            return j(Q, A, V, J)
        }
        function $(Q, A) {
            return D(Q.dims, A)
        }
        function U(Q) {
            return j(Q, 1n, "int64", BigInt64Array)
        }
        function H(Q) {
            return U(Q.dims)
        }
        function Z(Q) {
            return j(Q, 0n, "int64", BigInt64Array)
        }
        function ee(Q) {
            return Z(Q.dims)
        }
        function le(Q) {
            let A = Q.reduce( (V, J) => V * J, 1);
            return new C("float32",Float32Array.from({
                length: A
            }, () => Math.random()),Q)
        }
        function we(Q) {
            let A = Q.reduce( (J, ae) => J * ae, 1);
            function V() {
                let J = 1 - Math.random()
                  , ae = 1 - Math.random();
                return Math.sqrt(-2 * Math.log(J)) * Math.cos(2 * Math.PI * ae)
            }
            return new C("float32",Float32Array.from({
                length: A
            }, () => V()),Q)
        }
        function ce(Q, A) {
            if (Q.dims.length !== 2)
                throw new Error("The tensor must have 2 dimensions");
            if (Q.dims.at(-1) % 8 !== 0)
                throw new Error("The last dimension of the tensor must be a multiple of 8");
            if (!["binary", "ubinary"].includes(A))
                throw new Error("The precision must be either 'binary' or 'ubinary'");
            let V = A === "binary"
              , J = V ? "int8" : "uint8"
              , ae = V ? Int8Array : Uint8Array
              , xe = Q.data
              , be = new ae(xe.length / 8);
            for (let Ae = 0; Ae < xe.length; ++Ae) {
                let We = xe[Ae] > 0 ? 1 : 0
                  , he = Math.floor(Ae / 8)
                  , c = Ae % 8;
                be[he] |= We << 7 - c,
                V && c === 0 && (be[he] -= 128)
            }
            return new C(J,be,[Q.dims[0], Q.dims[1] / 8])
        }
    }
    ),
    "./src/utils/video.js": ( (de, u, e) => {
        e.r(u),
        e.d(u, {
            RawVideo: () => R,
            RawVideoFrame: () => b,
            load_video: () => C
        });
        var l = e("./src/utils/image.js")
          , h = e("./src/env.js");
        class b {
            constructor(f, L) {
                this.image = f,
                this.timestamp = L
            }
        }
        class R {
            constructor(f, L) {
                f.length > 0 && f[0]instanceof l.RawImage && (f = f.map( (_, a) => new b(_,(a + 1) / (f.length + 1) * L))),
                this.frames = f,
                this.duration = L
            }
            get width() {
                return this.frames[0].image.width
            }
            get height() {
                return this.frames[0].image.height
            }
            get fps() {
                return this.frames.length / this.duration
            }
        }
        async function C(M, {num_frames: f=null, fps: L=null}={}) {
            if (!h.apis.IS_BROWSER_ENV)
                throw new Error("`load_video` is currently only supported in browser environments.");
            if (f == null && L == null)
                throw new Error("Either num_frames or fps must be provided.");
            let _ = []
              , a = document.createElement("video");
            if (a.crossOrigin = "anonymous",
            a.muted = !0,
            typeof M == "string")
                a.src = M;
            else if (M instanceof Blob)
                a.src = URL.createObjectURL(M);
            else if (M instanceof HTMLVideoElement)
                a.src = M.src;
            else
                throw new Error("Invalid URL or video element provided.");
            if (await new Promise(I => a.onloadedmetadata = I),
            a.seekable.start(0) === a.seekable.end(0)) {
                let p = await (await fetch(a.src)).blob();
                a.src = URL.createObjectURL(p),
                await new Promise(m => a.onloadedmetadata = m)
            }
            let v = a.duration, g, y;
            f != null ? (g = f,
            y = f === 1 ? 0 : v / (f - 1)) : (y = 1 / L,
            g = Math.floor(v / y));
            let W = [];
            for (let I = 0; I < g; ++I)
                W.push(f === 1 ? v / 2 : I * y);
            let T = document.createElement("canvas");
            T.width = a.videoWidth,
            T.height = a.videoHeight;
            let k = T.getContext("2d", {
                willReadFrequently: !0
            });
            for (let I of W) {
                a.currentTime = I,
                await new Promise(o => {
                    a.onseeked = o
                }
                ),
                k.drawImage(a, 0, 0, T.width, T.height);
                let p = k.getImageData(0, 0, T.width, T.height)
                  , m = new l.RawImage(p.data,T.width,T.height,4)
                  , E = new b(m,I);
                _.push(E)
            }
            return a.remove(),
            new R(_,v)
        }
    }
    )
}
  , Id = {};
function pt(de) {
    var u = Id[de];
    if (u !== void 0)
        return u.exports;
    var e = Id[de] = {
        exports: {}
    };
    return ju[de](e, e.exports, pt),
    e.exports
}
( () => {
    var de = Object.getPrototypeOf ? e => Object.getPrototypeOf(e) : e => e.__proto__, u;
    pt.t = function(e, l) {
        if (l & 1 && (e = this(e)),
        l & 8 || typeof e == "object" && e && (l & 4 && e.__esModule || l & 16 && typeof e.then == "function"))
            return e;
        var h = Object.create(null);
        pt.r(h);
        var b = {};
        u = u || [null, de({}), de([]), de(de)];
        for (var R = l & 2 && e; typeof R == "object" && !~u.indexOf(R); R = de(R))
            Object.getOwnPropertyNames(R).forEach(C => b[C] = () => e[C]);
        return b.default = () => e,
        pt.d(h, b),
        h
    }
}
)();
pt.d = (de, u) => {
    for (var e in u)
        pt.o(u, e) && !pt.o(de, e) && Object.defineProperty(de, e, {
            enumerable: !0,
            get: u[e]
        })
}
;
pt.o = (de, u) => Object.prototype.hasOwnProperty.call(de, u);
pt.r = de => {
    typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(de, Symbol.toStringTag, {
        value: "Module"
    }),
    Object.defineProperty(de, "__esModule", {
        value: !0
    })
}
;
var t = {};
( () => {
    pt.r(t),
    pt.d(t, {
        ASTFeatureExtractor: () => _.ASTFeatureExtractor,
        ASTForAudioClassification: () => e.ASTForAudioClassification,
        ASTModel: () => e.ASTModel,
        ASTPreTrainedModel: () => e.ASTPreTrainedModel,
        AlbertForMaskedLM: () => e.AlbertForMaskedLM,
        AlbertForQuestionAnswering: () => e.AlbertForQuestionAnswering,
        AlbertForSequenceClassification: () => e.AlbertForSequenceClassification,
        AlbertModel: () => e.AlbertModel,
        AlbertPreTrainedModel: () => e.AlbertPreTrainedModel,
        AlbertTokenizer: () => l.AlbertTokenizer,
        ArceeForCausalLM: () => e.ArceeForCausalLM,
        ArceeModel: () => e.ArceeModel,
        ArceePreTrainedModel: () => e.ArceePreTrainedModel,
        AudioClassificationPipeline: () => u.AudioClassificationPipeline,
        AutoConfig: () => h.AutoConfig,
        AutoFeatureExtractor: () => a.AutoFeatureExtractor,
        AutoImageProcessor: () => y.AutoImageProcessor,
        AutoModel: () => e.AutoModel,
        AutoModelForAudioClassification: () => e.AutoModelForAudioClassification,
        AutoModelForAudioFrameClassification: () => e.AutoModelForAudioFrameClassification,
        AutoModelForAudioTextToText: () => e.AutoModelForAudioTextToText,
        AutoModelForCTC: () => e.AutoModelForCTC,
        AutoModelForCausalLM: () => e.AutoModelForCausalLM,
        AutoModelForDepthEstimation: () => e.AutoModelForDepthEstimation,
        AutoModelForDocumentQuestionAnswering: () => e.AutoModelForDocumentQuestionAnswering,
        AutoModelForImageClassification: () => e.AutoModelForImageClassification,
        AutoModelForImageFeatureExtraction: () => e.AutoModelForImageFeatureExtraction,
        AutoModelForImageMatting: () => e.AutoModelForImageMatting,
        AutoModelForImageSegmentation: () => e.AutoModelForImageSegmentation,
        AutoModelForImageTextToText: () => e.AutoModelForImageTextToText,
        AutoModelForImageToImage: () => e.AutoModelForImageToImage,
        AutoModelForMaskGeneration: () => e.AutoModelForMaskGeneration,
        AutoModelForMaskedLM: () => e.AutoModelForMaskedLM,
        AutoModelForNormalEstimation: () => e.AutoModelForNormalEstimation,
        AutoModelForObjectDetection: () => e.AutoModelForObjectDetection,
        AutoModelForPoseEstimation: () => e.AutoModelForPoseEstimation,
        AutoModelForQuestionAnswering: () => e.AutoModelForQuestionAnswering,
        AutoModelForSemanticSegmentation: () => e.AutoModelForSemanticSegmentation,
        AutoModelForSeq2SeqLM: () => e.AutoModelForSeq2SeqLM,
        AutoModelForSequenceClassification: () => e.AutoModelForSequenceClassification,
        AutoModelForSpeechSeq2Seq: () => e.AutoModelForSpeechSeq2Seq,
        AutoModelForTextToSpectrogram: () => e.AutoModelForTextToSpectrogram,
        AutoModelForTextToWaveform: () => e.AutoModelForTextToWaveform,
        AutoModelForTokenClassification: () => e.AutoModelForTokenClassification,
        AutoModelForUniversalSegmentation: () => e.AutoModelForUniversalSegmentation,
        AutoModelForVision2Seq: () => e.AutoModelForVision2Seq,
        AutoModelForXVector: () => e.AutoModelForXVector,
        AutoModelForZeroShotObjectDetection: () => e.AutoModelForZeroShotObjectDetection,
        AutoProcessor: () => k.AutoProcessor,
        AutoTokenizer: () => l.AutoTokenizer,
        AutomaticSpeechRecognitionPipeline: () => u.AutomaticSpeechRecognitionPipeline,
        BackgroundRemovalPipeline: () => u.BackgroundRemovalPipeline,
        BartForConditionalGeneration: () => e.BartForConditionalGeneration,
        BartForSequenceClassification: () => e.BartForSequenceClassification,
        BartModel: () => e.BartModel,
        BartPretrainedModel: () => e.BartPretrainedModel,
        BartTokenizer: () => l.BartTokenizer,
        BaseModelOutput: () => e.BaseModelOutput,
        BaseStreamer: () => I.BaseStreamer,
        BeitFeatureExtractor: () => g.BeitFeatureExtractor,
        BeitForImageClassification: () => e.BeitForImageClassification,
        BeitModel: () => e.BeitModel,
        BeitPreTrainedModel: () => e.BeitPreTrainedModel,
        BertForMaskedLM: () => e.BertForMaskedLM,
        BertForQuestionAnswering: () => e.BertForQuestionAnswering,
        BertForSequenceClassification: () => e.BertForSequenceClassification,
        BertForTokenClassification: () => e.BertForTokenClassification,
        BertModel: () => e.BertModel,
        BertPreTrainedModel: () => e.BertPreTrainedModel,
        BertTokenizer: () => l.BertTokenizer,
        BitImageProcessor: () => g.BitImageProcessor,
        BlenderbotForConditionalGeneration: () => e.BlenderbotForConditionalGeneration,
        BlenderbotModel: () => e.BlenderbotModel,
        BlenderbotPreTrainedModel: () => e.BlenderbotPreTrainedModel,
        BlenderbotSmallForConditionalGeneration: () => e.BlenderbotSmallForConditionalGeneration,
        BlenderbotSmallModel: () => e.BlenderbotSmallModel,
        BlenderbotSmallPreTrainedModel: () => e.BlenderbotSmallPreTrainedModel,
        BlenderbotSmallTokenizer: () => l.BlenderbotSmallTokenizer,
        BlenderbotTokenizer: () => l.BlenderbotTokenizer,
        BloomForCausalLM: () => e.BloomForCausalLM,
        BloomModel: () => e.BloomModel,
        BloomPreTrainedModel: () => e.BloomPreTrainedModel,
        BloomTokenizer: () => l.BloomTokenizer,
        CLIPFeatureExtractor: () => g.CLIPFeatureExtractor,
        CLIPImageProcessor: () => g.CLIPImageProcessor,
        CLIPModel: () => e.CLIPModel,
        CLIPPreTrainedModel: () => e.CLIPPreTrainedModel,
        CLIPSegForImageSegmentation: () => e.CLIPSegForImageSegmentation,
        CLIPSegModel: () => e.CLIPSegModel,
        CLIPSegPreTrainedModel: () => e.CLIPSegPreTrainedModel,
        CLIPTextModel: () => e.CLIPTextModel,
        CLIPTextModelWithProjection: () => e.CLIPTextModelWithProjection,
        CLIPTokenizer: () => l.CLIPTokenizer,
        CLIPVisionModel: () => e.CLIPVisionModel,
        CLIPVisionModelWithProjection: () => e.CLIPVisionModelWithProjection,
        CamembertForMaskedLM: () => e.CamembertForMaskedLM,
        CamembertForQuestionAnswering: () => e.CamembertForQuestionAnswering,
        CamembertForSequenceClassification: () => e.CamembertForSequenceClassification,
        CamembertForTokenClassification: () => e.CamembertForTokenClassification,
        CamembertModel: () => e.CamembertModel,
        CamembertPreTrainedModel: () => e.CamembertPreTrainedModel,
        CamembertTokenizer: () => l.CamembertTokenizer,
        CausalLMOutput: () => e.CausalLMOutput,
        CausalLMOutputWithPast: () => e.CausalLMOutputWithPast,
        ChineseCLIPFeatureExtractor: () => g.ChineseCLIPFeatureExtractor,
        ChineseCLIPModel: () => e.ChineseCLIPModel,
        ChineseCLIPPreTrainedModel: () => e.ChineseCLIPPreTrainedModel,
        ClapAudioModelWithProjection: () => e.ClapAudioModelWithProjection,
        ClapFeatureExtractor: () => _.ClapFeatureExtractor,
        ClapModel: () => e.ClapModel,
        ClapPreTrainedModel: () => e.ClapPreTrainedModel,
        ClapTextModelWithProjection: () => e.ClapTextModelWithProjection,
        ClassifierFreeGuidanceLogitsProcessor: () => m.ClassifierFreeGuidanceLogitsProcessor,
        CodeGenForCausalLM: () => e.CodeGenForCausalLM,
        CodeGenModel: () => e.CodeGenModel,
        CodeGenPreTrainedModel: () => e.CodeGenPreTrainedModel,
        CodeGenTokenizer: () => l.CodeGenTokenizer,
        CodeLlamaTokenizer: () => l.CodeLlamaTokenizer,
        CohereForCausalLM: () => e.CohereForCausalLM,
        CohereModel: () => e.CohereModel,
        CoherePreTrainedModel: () => e.CoherePreTrainedModel,
        CohereTokenizer: () => l.CohereTokenizer,
        ConvBertForMaskedLM: () => e.ConvBertForMaskedLM,
        ConvBertForQuestionAnswering: () => e.ConvBertForQuestionAnswering,
        ConvBertForSequenceClassification: () => e.ConvBertForSequenceClassification,
        ConvBertForTokenClassification: () => e.ConvBertForTokenClassification,
        ConvBertModel: () => e.ConvBertModel,
        ConvBertPreTrainedModel: () => e.ConvBertPreTrainedModel,
        ConvBertTokenizer: () => l.ConvBertTokenizer,
        ConvNextFeatureExtractor: () => g.ConvNextFeatureExtractor,
        ConvNextForImageClassification: () => e.ConvNextForImageClassification,
        ConvNextImageProcessor: () => g.ConvNextImageProcessor,
        ConvNextModel: () => e.ConvNextModel,
        ConvNextPreTrainedModel: () => e.ConvNextPreTrainedModel,
        ConvNextV2ForImageClassification: () => e.ConvNextV2ForImageClassification,
        ConvNextV2Model: () => e.ConvNextV2Model,
        ConvNextV2PreTrainedModel: () => e.ConvNextV2PreTrainedModel,
        DFineForObjectDetection: () => e.DFineForObjectDetection,
        DFineModel: () => e.DFineModel,
        DFinePreTrainedModel: () => e.DFinePreTrainedModel,
        DINOv3ConvNextModel: () => e.DINOv3ConvNextModel,
        DINOv3ConvNextPreTrainedModel: () => e.DINOv3ConvNextPreTrainedModel,
        DINOv3ViTImageProcessor: () => g.DINOv3ViTImageProcessor,
        DINOv3ViTModel: () => e.DINOv3ViTModel,
        DINOv3ViTPreTrainedModel: () => e.DINOv3ViTPreTrainedModel,
        DPTFeatureExtractor: () => g.DPTFeatureExtractor,
        DPTForDepthEstimation: () => e.DPTForDepthEstimation,
        DPTImageProcessor: () => g.DPTImageProcessor,
        DPTModel: () => e.DPTModel,
        DPTPreTrainedModel: () => e.DPTPreTrainedModel,
        DacDecoderModel: () => e.DacDecoderModel,
        DacDecoderOutput: () => e.DacDecoderOutput,
        DacEncoderModel: () => e.DacEncoderModel,
        DacEncoderOutput: () => e.DacEncoderOutput,
        DacFeatureExtractor: () => _.DacFeatureExtractor,
        DacModel: () => e.DacModel,
        DacPreTrainedModel: () => e.DacPreTrainedModel,
        DataTypeMap: () => M.DataTypeMap,
        DebertaForMaskedLM: () => e.DebertaForMaskedLM,
        DebertaForQuestionAnswering: () => e.DebertaForQuestionAnswering,
        DebertaForSequenceClassification: () => e.DebertaForSequenceClassification,
        DebertaForTokenClassification: () => e.DebertaForTokenClassification,
        DebertaModel: () => e.DebertaModel,
        DebertaPreTrainedModel: () => e.DebertaPreTrainedModel,
        DebertaTokenizer: () => l.DebertaTokenizer,
        DebertaV2ForMaskedLM: () => e.DebertaV2ForMaskedLM,
        DebertaV2ForQuestionAnswering: () => e.DebertaV2ForQuestionAnswering,
        DebertaV2ForSequenceClassification: () => e.DebertaV2ForSequenceClassification,
        DebertaV2ForTokenClassification: () => e.DebertaV2ForTokenClassification,
        DebertaV2Model: () => e.DebertaV2Model,
        DebertaV2PreTrainedModel: () => e.DebertaV2PreTrainedModel,
        DebertaV2Tokenizer: () => l.DebertaV2Tokenizer,
        DecisionTransformerModel: () => e.DecisionTransformerModel,
        DecisionTransformerPreTrainedModel: () => e.DecisionTransformerPreTrainedModel,
        DeiTFeatureExtractor: () => g.DeiTFeatureExtractor,
        DeiTForImageClassification: () => e.DeiTForImageClassification,
        DeiTImageProcessor: () => g.DeiTImageProcessor,
        DeiTModel: () => e.DeiTModel,
        DeiTPreTrainedModel: () => e.DeiTPreTrainedModel,
        DepthAnythingForDepthEstimation: () => e.DepthAnythingForDepthEstimation,
        DepthAnythingPreTrainedModel: () => e.DepthAnythingPreTrainedModel,
        DepthEstimationPipeline: () => u.DepthEstimationPipeline,
        DepthProForDepthEstimation: () => e.DepthProForDepthEstimation,
        DepthProPreTrainedModel: () => e.DepthProPreTrainedModel,
        DetrFeatureExtractor: () => g.DetrFeatureExtractor,
        DetrForObjectDetection: () => e.DetrForObjectDetection,
        DetrForSegmentation: () => e.DetrForSegmentation,
        DetrImageProcessor: () => g.DetrImageProcessor,
        DetrModel: () => e.DetrModel,
        DetrObjectDetectionOutput: () => e.DetrObjectDetectionOutput,
        DetrPreTrainedModel: () => e.DetrPreTrainedModel,
        DetrSegmentationOutput: () => e.DetrSegmentationOutput,
        Dinov2ForImageClassification: () => e.Dinov2ForImageClassification,
        Dinov2Model: () => e.Dinov2Model,
        Dinov2PreTrainedModel: () => e.Dinov2PreTrainedModel,
        Dinov2WithRegistersForImageClassification: () => e.Dinov2WithRegistersForImageClassification,
        Dinov2WithRegistersModel: () => e.Dinov2WithRegistersModel,
        Dinov2WithRegistersPreTrainedModel: () => e.Dinov2WithRegistersPreTrainedModel,
        DistilBertForMaskedLM: () => e.DistilBertForMaskedLM,
        DistilBertForQuestionAnswering: () => e.DistilBertForQuestionAnswering,
        DistilBertForSequenceClassification: () => e.DistilBertForSequenceClassification,
        DistilBertForTokenClassification: () => e.DistilBertForTokenClassification,
        DistilBertModel: () => e.DistilBertModel,
        DistilBertPreTrainedModel: () => e.DistilBertPreTrainedModel,
        DistilBertTokenizer: () => l.DistilBertTokenizer,
        DocumentQuestionAnsweringPipeline: () => u.DocumentQuestionAnsweringPipeline,
        DonutFeatureExtractor: () => g.DonutFeatureExtractor,
        DonutImageProcessor: () => g.DonutImageProcessor,
        DonutSwinModel: () => e.DonutSwinModel,
        DonutSwinPreTrainedModel: () => e.DonutSwinPreTrainedModel,
        EdgeTamModel: () => e.EdgeTamModel,
        EfficientNetForImageClassification: () => e.EfficientNetForImageClassification,
        EfficientNetImageProcessor: () => g.EfficientNetImageProcessor,
        EfficientNetModel: () => e.EfficientNetModel,
        EfficientNetPreTrainedModel: () => e.EfficientNetPreTrainedModel,
        ElectraForMaskedLM: () => e.ElectraForMaskedLM,
        ElectraForQuestionAnswering: () => e.ElectraForQuestionAnswering,
        ElectraForSequenceClassification: () => e.ElectraForSequenceClassification,
        ElectraForTokenClassification: () => e.ElectraForTokenClassification,
        ElectraModel: () => e.ElectraModel,
        ElectraPreTrainedModel: () => e.ElectraPreTrainedModel,
        ElectraTokenizer: () => l.ElectraTokenizer,
        EncodecFeatureExtractor: () => _.EncodecFeatureExtractor,
        EosTokenCriteria: () => p.EosTokenCriteria,
        Ernie4_5_ForCausalLM: () => e.Ernie4_5_ForCausalLM,
        Ernie4_5_Model: () => e.Ernie4_5_Model,
        Ernie4_5_PretrainedModel: () => e.Ernie4_5_PretrainedModel,
        Ernie4_5_Tokenizer: () => l.Ernie4_5_Tokenizer,
        EsmForMaskedLM: () => e.EsmForMaskedLM,
        EsmForSequenceClassification: () => e.EsmForSequenceClassification,
        EsmForTokenClassification: () => e.EsmForTokenClassification,
        EsmModel: () => e.EsmModel,
        EsmPreTrainedModel: () => e.EsmPreTrainedModel,
        EsmTokenizer: () => l.EsmTokenizer,
        ExaoneForCausalLM: () => e.ExaoneForCausalLM,
        ExaoneModel: () => e.ExaoneModel,
        ExaonePreTrainedModel: () => e.ExaonePreTrainedModel,
        FFT: () => f.FFT,
        FalconForCausalLM: () => e.FalconForCausalLM,
        FalconModel: () => e.FalconModel,
        FalconPreTrainedModel: () => e.FalconPreTrainedModel,
        FalconTokenizer: () => l.FalconTokenizer,
        FastViTForImageClassification: () => e.FastViTForImageClassification,
        FastViTModel: () => e.FastViTModel,
        FastViTPreTrainedModel: () => e.FastViTPreTrainedModel,
        FeatureExtractionPipeline: () => u.FeatureExtractionPipeline,
        FeatureExtractor: () => L.FeatureExtractor,
        FillMaskPipeline: () => u.FillMaskPipeline,
        Florence2ForConditionalGeneration: () => e.Florence2ForConditionalGeneration,
        Florence2PreTrainedModel: () => e.Florence2PreTrainedModel,
        Florence2Processor: () => T.Florence2Processor,
        ForcedBOSTokenLogitsProcessor: () => m.ForcedBOSTokenLogitsProcessor,
        ForcedEOSTokenLogitsProcessor: () => m.ForcedEOSTokenLogitsProcessor,
        GLPNFeatureExtractor: () => g.GLPNFeatureExtractor,
        GLPNForDepthEstimation: () => e.GLPNForDepthEstimation,
        GLPNModel: () => e.GLPNModel,
        GLPNPreTrainedModel: () => e.GLPNPreTrainedModel,
        GPT2LMHeadModel: () => e.GPT2LMHeadModel,
        GPT2Model: () => e.GPT2Model,
        GPT2PreTrainedModel: () => e.GPT2PreTrainedModel,
        GPT2Tokenizer: () => l.GPT2Tokenizer,
        GPTBigCodeForCausalLM: () => e.GPTBigCodeForCausalLM,
        GPTBigCodeModel: () => e.GPTBigCodeModel,
        GPTBigCodePreTrainedModel: () => e.GPTBigCodePreTrainedModel,
        GPTJForCausalLM: () => e.GPTJForCausalLM,
        GPTJModel: () => e.GPTJModel,
        GPTJPreTrainedModel: () => e.GPTJPreTrainedModel,
        GPTNeoForCausalLM: () => e.GPTNeoForCausalLM,
        GPTNeoModel: () => e.GPTNeoModel,
        GPTNeoPreTrainedModel: () => e.GPTNeoPreTrainedModel,
        GPTNeoXForCausalLM: () => e.GPTNeoXForCausalLM,
        GPTNeoXModel: () => e.GPTNeoXModel,
        GPTNeoXPreTrainedModel: () => e.GPTNeoXPreTrainedModel,
        GPTNeoXTokenizer: () => l.GPTNeoXTokenizer,
        Gemma2ForCausalLM: () => e.Gemma2ForCausalLM,
        Gemma2Model: () => e.Gemma2Model,
        Gemma2PreTrainedModel: () => e.Gemma2PreTrainedModel,
        Gemma3ForCausalLM: () => e.Gemma3ForCausalLM,
        Gemma3Model: () => e.Gemma3Model,
        Gemma3PreTrainedModel: () => e.Gemma3PreTrainedModel,
        Gemma3nAudioFeatureExtractor: () => _.Gemma3nAudioFeatureExtractor,
        Gemma3nForConditionalGeneration: () => e.Gemma3nForConditionalGeneration,
        Gemma3nPreTrainedModel: () => e.Gemma3nPreTrainedModel,
        Gemma3nProcessor: () => T.Gemma3nProcessor,
        GemmaForCausalLM: () => e.GemmaForCausalLM,
        GemmaModel: () => e.GemmaModel,
        GemmaPreTrainedModel: () => e.GemmaPreTrainedModel,
        GemmaTokenizer: () => l.GemmaTokenizer,
        GlmForCausalLM: () => e.GlmForCausalLM,
        GlmModel: () => e.GlmModel,
        GlmPreTrainedModel: () => e.GlmPreTrainedModel,
        GraniteForCausalLM: () => e.GraniteForCausalLM,
        GraniteModel: () => e.GraniteModel,
        GraniteMoeHybridForCausalLM: () => e.GraniteMoeHybridForCausalLM,
        GraniteMoeHybridModel: () => e.GraniteMoeHybridModel,
        GraniteMoeHybridPreTrainedModel: () => e.GraniteMoeHybridPreTrainedModel,
        GranitePreTrainedModel: () => e.GranitePreTrainedModel,
        Grok1Tokenizer: () => l.Grok1Tokenizer,
        GroundingDinoForObjectDetection: () => e.GroundingDinoForObjectDetection,
        GroundingDinoImageProcessor: () => g.GroundingDinoImageProcessor,
        GroundingDinoPreTrainedModel: () => e.GroundingDinoPreTrainedModel,
        GroundingDinoProcessor: () => T.GroundingDinoProcessor,
        GroupViTModel: () => e.GroupViTModel,
        GroupViTPreTrainedModel: () => e.GroupViTPreTrainedModel,
        HeliumForCausalLM: () => e.HeliumForCausalLM,
        HeliumModel: () => e.HeliumModel,
        HeliumPreTrainedModel: () => e.HeliumPreTrainedModel,
        HerbertTokenizer: () => l.HerbertTokenizer,
        HieraForImageClassification: () => e.HieraForImageClassification,
        HieraModel: () => e.HieraModel,
        HieraPreTrainedModel: () => e.HieraPreTrainedModel,
        HubertForCTC: () => e.HubertForCTC,
        HubertForSequenceClassification: () => e.HubertForSequenceClassification,
        HubertModel: () => e.HubertModel,
        HubertPreTrainedModel: () => e.HubertPreTrainedModel,
        IJepaForImageClassification: () => e.IJepaForImageClassification,
        IJepaModel: () => e.IJepaModel,
        IJepaPreTrainedModel: () => e.IJepaPreTrainedModel,
        Idefics3ForConditionalGeneration: () => e.Idefics3ForConditionalGeneration,
        Idefics3ImageProcessor: () => g.Idefics3ImageProcessor,
        Idefics3PreTrainedModel: () => e.Idefics3PreTrainedModel,
        Idefics3Processor: () => T.Idefics3Processor,
        ImageClassificationPipeline: () => u.ImageClassificationPipeline,
        ImageFeatureExtractionPipeline: () => u.ImageFeatureExtractionPipeline,
        ImageFeatureExtractor: () => _.ImageFeatureExtractor,
        ImageMattingOutput: () => e.ImageMattingOutput,
        ImageProcessor: () => v.ImageProcessor,
        ImageSegmentationPipeline: () => u.ImageSegmentationPipeline,
        ImageToImagePipeline: () => u.ImageToImagePipeline,
        ImageToTextPipeline: () => u.ImageToTextPipeline,
        InterruptableStoppingCriteria: () => p.InterruptableStoppingCriteria,
        JAISLMHeadModel: () => e.JAISLMHeadModel,
        JAISModel: () => e.JAISModel,
        JAISPreTrainedModel: () => e.JAISPreTrainedModel,
        JinaCLIPImageProcessor: () => g.JinaCLIPImageProcessor,
        JinaCLIPModel: () => e.JinaCLIPModel,
        JinaCLIPPreTrainedModel: () => e.JinaCLIPPreTrainedModel,
        JinaCLIPProcessor: () => T.JinaCLIPProcessor,
        JinaCLIPTextModel: () => e.JinaCLIPTextModel,
        JinaCLIPVisionModel: () => e.JinaCLIPVisionModel,
        Lfm2ForCausalLM: () => e.Lfm2ForCausalLM,
        Lfm2Model: () => e.Lfm2Model,
        Lfm2PreTrainedModel: () => e.Lfm2PreTrainedModel,
        LiteWhisperForConditionalGeneration: () => e.LiteWhisperForConditionalGeneration,
        Llama4ForCausalLM: () => e.Llama4ForCausalLM,
        Llama4PreTrainedModel: () => e.Llama4PreTrainedModel,
        LlamaForCausalLM: () => e.LlamaForCausalLM,
        LlamaModel: () => e.LlamaModel,
        LlamaPreTrainedModel: () => e.LlamaPreTrainedModel,
        LlamaTokenizer: () => l.LlamaTokenizer,
        LlavaForConditionalGeneration: () => e.LlavaForConditionalGeneration,
        LlavaOnevisionForConditionalGeneration: () => e.LlavaOnevisionForConditionalGeneration,
        LlavaOnevisionImageProcessor: () => g.LlavaOnevisionImageProcessor,
        LlavaPreTrainedModel: () => e.LlavaPreTrainedModel,
        LlavaProcessor: () => T.LlavaProcessor,
        LlavaQwen2ForCausalLM: () => e.LlavaQwen2ForCausalLM,
        LogitsProcessor: () => m.LogitsProcessor,
        LogitsProcessorList: () => m.LogitsProcessorList,
        LogitsWarper: () => m.LogitsWarper,
        LongT5ForConditionalGeneration: () => e.LongT5ForConditionalGeneration,
        LongT5Model: () => e.LongT5Model,
        LongT5PreTrainedModel: () => e.LongT5PreTrainedModel,
        M2M100ForConditionalGeneration: () => e.M2M100ForConditionalGeneration,
        M2M100Model: () => e.M2M100Model,
        M2M100PreTrainedModel: () => e.M2M100PreTrainedModel,
        M2M100Tokenizer: () => l.M2M100Tokenizer,
        MBart50Tokenizer: () => l.MBart50Tokenizer,
        MBartForCausalLM: () => e.MBartForCausalLM,
        MBartForConditionalGeneration: () => e.MBartForConditionalGeneration,
        MBartForSequenceClassification: () => e.MBartForSequenceClassification,
        MBartModel: () => e.MBartModel,
        MBartPreTrainedModel: () => e.MBartPreTrainedModel,
        MBartTokenizer: () => l.MBartTokenizer,
        MPNetForMaskedLM: () => e.MPNetForMaskedLM,
        MPNetForQuestionAnswering: () => e.MPNetForQuestionAnswering,
        MPNetForSequenceClassification: () => e.MPNetForSequenceClassification,
        MPNetForTokenClassification: () => e.MPNetForTokenClassification,
        MPNetModel: () => e.MPNetModel,
        MPNetPreTrainedModel: () => e.MPNetPreTrainedModel,
        MPNetTokenizer: () => l.MPNetTokenizer,
        MT5ForConditionalGeneration: () => e.MT5ForConditionalGeneration,
        MT5Model: () => e.MT5Model,
        MT5PreTrainedModel: () => e.MT5PreTrainedModel,
        MarianMTModel: () => e.MarianMTModel,
        MarianModel: () => e.MarianModel,
        MarianPreTrainedModel: () => e.MarianPreTrainedModel,
        MarianTokenizer: () => l.MarianTokenizer,
        Mask2FormerImageProcessor: () => g.Mask2FormerImageProcessor,
        MaskFormerFeatureExtractor: () => g.MaskFormerFeatureExtractor,
        MaskFormerForInstanceSegmentation: () => e.MaskFormerForInstanceSegmentation,
        MaskFormerImageProcessor: () => g.MaskFormerImageProcessor,
        MaskFormerModel: () => e.MaskFormerModel,
        MaskFormerPreTrainedModel: () => e.MaskFormerPreTrainedModel,
        MaskedLMOutput: () => e.MaskedLMOutput,
        MaxLengthCriteria: () => p.MaxLengthCriteria,
        Metric3DForDepthEstimation: () => e.Metric3DForDepthEstimation,
        Metric3DPreTrainedModel: () => e.Metric3DPreTrainedModel,
        Metric3Dv2ForDepthEstimation: () => e.Metric3Dv2ForDepthEstimation,
        Metric3Dv2PreTrainedModel: () => e.Metric3Dv2PreTrainedModel,
        MgpstrForSceneTextRecognition: () => e.MgpstrForSceneTextRecognition,
        MgpstrModelOutput: () => e.MgpstrModelOutput,
        MgpstrPreTrainedModel: () => e.MgpstrPreTrainedModel,
        MgpstrProcessor: () => T.MgpstrProcessor,
        MgpstrTokenizer: () => l.MgpstrTokenizer,
        MimiDecoderModel: () => e.MimiDecoderModel,
        MimiDecoderOutput: () => e.MimiDecoderOutput,
        MimiEncoderModel: () => e.MimiEncoderModel,
        MimiEncoderOutput: () => e.MimiEncoderOutput,
        MimiModel: () => e.MimiModel,
        MimiPreTrainedModel: () => e.MimiPreTrainedModel,
        MinLengthLogitsProcessor: () => m.MinLengthLogitsProcessor,
        MinNewTokensLengthLogitsProcessor: () => m.MinNewTokensLengthLogitsProcessor,
        MistralForCausalLM: () => e.MistralForCausalLM,
        MistralModel: () => e.MistralModel,
        MistralPreTrainedModel: () => e.MistralPreTrainedModel,
        MobileBertForMaskedLM: () => e.MobileBertForMaskedLM,
        MobileBertForQuestionAnswering: () => e.MobileBertForQuestionAnswering,
        MobileBertForSequenceClassification: () => e.MobileBertForSequenceClassification,
        MobileBertModel: () => e.MobileBertModel,
        MobileBertPreTrainedModel: () => e.MobileBertPreTrainedModel,
        MobileBertTokenizer: () => l.MobileBertTokenizer,
        MobileLLMForCausalLM: () => e.MobileLLMForCausalLM,
        MobileLLMModel: () => e.MobileLLMModel,
        MobileLLMPreTrainedModel: () => e.MobileLLMPreTrainedModel,
        MobileNetV1FeatureExtractor: () => g.MobileNetV1FeatureExtractor,
        MobileNetV1ForImageClassification: () => e.MobileNetV1ForImageClassification,
        MobileNetV1ForSemanticSegmentation: () => e.MobileNetV1ForSemanticSegmentation,
        MobileNetV1ImageProcessor: () => g.MobileNetV1ImageProcessor,
        MobileNetV1Model: () => e.MobileNetV1Model,
        MobileNetV1PreTrainedModel: () => e.MobileNetV1PreTrainedModel,
        MobileNetV2FeatureExtractor: () => g.MobileNetV2FeatureExtractor,
        MobileNetV2ForImageClassification: () => e.MobileNetV2ForImageClassification,
        MobileNetV2ForSemanticSegmentation: () => e.MobileNetV2ForSemanticSegmentation,
        MobileNetV2ImageProcessor: () => g.MobileNetV2ImageProcessor,
        MobileNetV2Model: () => e.MobileNetV2Model,
        MobileNetV2PreTrainedModel: () => e.MobileNetV2PreTrainedModel,
        MobileNetV3FeatureExtractor: () => g.MobileNetV3FeatureExtractor,
        MobileNetV3ForImageClassification: () => e.MobileNetV3ForImageClassification,
        MobileNetV3ForSemanticSegmentation: () => e.MobileNetV3ForSemanticSegmentation,
        MobileNetV3ImageProcessor: () => g.MobileNetV3ImageProcessor,
        MobileNetV3Model: () => e.MobileNetV3Model,
        MobileNetV3PreTrainedModel: () => e.MobileNetV3PreTrainedModel,
        MobileNetV4FeatureExtractor: () => g.MobileNetV4FeatureExtractor,
        MobileNetV4ForImageClassification: () => e.MobileNetV4ForImageClassification,
        MobileNetV4ForSemanticSegmentation: () => e.MobileNetV4ForSemanticSegmentation,
        MobileNetV4ImageProcessor: () => g.MobileNetV4ImageProcessor,
        MobileNetV4Model: () => e.MobileNetV4Model,
        MobileNetV4PreTrainedModel: () => e.MobileNetV4PreTrainedModel,
        MobileViTFeatureExtractor: () => g.MobileViTFeatureExtractor,
        MobileViTForImageClassification: () => e.MobileViTForImageClassification,
        MobileViTImageProcessor: () => g.MobileViTImageProcessor,
        MobileViTModel: () => e.MobileViTModel,
        MobileViTPreTrainedModel: () => e.MobileViTPreTrainedModel,
        MobileViTV2ForImageClassification: () => e.MobileViTV2ForImageClassification,
        MobileViTV2Model: () => e.MobileViTV2Model,
        MobileViTV2PreTrainedModel: () => e.MobileViTV2PreTrainedModel,
        ModelOutput: () => e.ModelOutput,
        ModernBertDecoderForCausalLM: () => e.ModernBertDecoderForCausalLM,
        ModernBertDecoderModel: () => e.ModernBertDecoderModel,
        ModernBertDecoderPreTrainedModel: () => e.ModernBertDecoderPreTrainedModel,
        ModernBertForMaskedLM: () => e.ModernBertForMaskedLM,
        ModernBertForSequenceClassification: () => e.ModernBertForSequenceClassification,
        ModernBertForTokenClassification: () => e.ModernBertForTokenClassification,
        ModernBertModel: () => e.ModernBertModel,
        ModernBertPreTrainedModel: () => e.ModernBertPreTrainedModel,
        Moondream1ForConditionalGeneration: () => e.Moondream1ForConditionalGeneration,
        MoonshineFeatureExtractor: () => _.MoonshineFeatureExtractor,
        MoonshineForConditionalGeneration: () => e.MoonshineForConditionalGeneration,
        MoonshineModel: () => e.MoonshineModel,
        MoonshinePreTrainedModel: () => e.MoonshinePreTrainedModel,
        MoonshineProcessor: () => T.MoonshineProcessor,
        MptForCausalLM: () => e.MptForCausalLM,
        MptModel: () => e.MptModel,
        MptPreTrainedModel: () => e.MptPreTrainedModel,
        MultiModalityCausalLM: () => e.MultiModalityCausalLM,
        MultiModalityPreTrainedModel: () => e.MultiModalityPreTrainedModel,
        MusicgenForCausalLM: () => e.MusicgenForCausalLM,
        MusicgenForConditionalGeneration: () => e.MusicgenForConditionalGeneration,
        MusicgenModel: () => e.MusicgenModel,
        MusicgenPreTrainedModel: () => e.MusicgenPreTrainedModel,
        NanoChatForCausalLM: () => e.NanoChatForCausalLM,
        NanoChatModel: () => e.NanoChatModel,
        NanoChatPreTrainedModel: () => e.NanoChatPreTrainedModel,
        NeoBertForMaskedLM: () => e.NeoBertForMaskedLM,
        NeoBertForQuestionAnswering: () => e.NeoBertForQuestionAnswering,
        NeoBertForSequenceClassification: () => e.NeoBertForSequenceClassification,
        NeoBertForTokenClassification: () => e.NeoBertForTokenClassification,
        NeoBertModel: () => e.NeoBertModel,
        NeoBertPreTrainedModel: () => e.NeoBertPreTrainedModel,
        NllbTokenizer: () => l.NllbTokenizer,
        NoBadWordsLogitsProcessor: () => m.NoBadWordsLogitsProcessor,
        NoRepeatNGramLogitsProcessor: () => m.NoRepeatNGramLogitsProcessor,
        NomicBertModel: () => e.NomicBertModel,
        NomicBertPreTrainedModel: () => e.NomicBertPreTrainedModel,
        NougatImageProcessor: () => g.NougatImageProcessor,
        NougatTokenizer: () => l.NougatTokenizer,
        OPTForCausalLM: () => e.OPTForCausalLM,
        OPTModel: () => e.OPTModel,
        OPTPreTrainedModel: () => e.OPTPreTrainedModel,
        ObjectDetectionPipeline: () => u.ObjectDetectionPipeline,
        Olmo2ForCausalLM: () => e.Olmo2ForCausalLM,
        Olmo2Model: () => e.Olmo2Model,
        Olmo2PreTrainedModel: () => e.Olmo2PreTrainedModel,
        OlmoForCausalLM: () => e.OlmoForCausalLM,
        OlmoModel: () => e.OlmoModel,
        OlmoPreTrainedModel: () => e.OlmoPreTrainedModel,
        OpenELMForCausalLM: () => e.OpenELMForCausalLM,
        OpenELMModel: () => e.OpenELMModel,
        OpenELMPreTrainedModel: () => e.OpenELMPreTrainedModel,
        OwlViTFeatureExtractor: () => g.OwlViTFeatureExtractor,
        OwlViTForObjectDetection: () => e.OwlViTForObjectDetection,
        OwlViTImageProcessor: () => g.OwlViTImageProcessor,
        OwlViTModel: () => e.OwlViTModel,
        OwlViTPreTrainedModel: () => e.OwlViTPreTrainedModel,
        OwlViTProcessor: () => T.OwlViTProcessor,
        Owlv2ForObjectDetection: () => e.Owlv2ForObjectDetection,
        Owlv2ImageProcessor: () => g.Owlv2ImageProcessor,
        Owlv2Model: () => e.Owlv2Model,
        Owlv2PreTrainedModel: () => e.Owlv2PreTrainedModel,
        PaliGemmaForConditionalGeneration: () => e.PaliGemmaForConditionalGeneration,
        PaliGemmaPreTrainedModel: () => e.PaliGemmaPreTrainedModel,
        PaliGemmaProcessor: () => T.PaliGemmaProcessor,
        ParakeetFeatureExtractor: () => _.ParakeetFeatureExtractor,
        ParakeetForCTC: () => e.ParakeetForCTC,
        ParakeetPreTrainedModel: () => e.ParakeetPreTrainedModel,
        PatchTSMixerForPrediction: () => e.PatchTSMixerForPrediction,
        PatchTSMixerModel: () => e.PatchTSMixerModel,
        PatchTSMixerPreTrainedModel: () => e.PatchTSMixerPreTrainedModel,
        PatchTSTForPrediction: () => e.PatchTSTForPrediction,
        PatchTSTModel: () => e.PatchTSTModel,
        PatchTSTPreTrainedModel: () => e.PatchTSTPreTrainedModel,
        Phi3ForCausalLM: () => e.Phi3ForCausalLM,
        Phi3Model: () => e.Phi3Model,
        Phi3PreTrainedModel: () => e.Phi3PreTrainedModel,
        Phi3VForCausalLM: () => e.Phi3VForCausalLM,
        Phi3VImageProcessor: () => g.Phi3VImageProcessor,
        Phi3VPreTrainedModel: () => e.Phi3VPreTrainedModel,
        Phi3VProcessor: () => T.Phi3VProcessor,
        PhiForCausalLM: () => e.PhiForCausalLM,
        PhiModel: () => e.PhiModel,
        PhiPreTrainedModel: () => e.PhiPreTrainedModel,
        Pipeline: () => u.Pipeline,
        PreTrainedModel: () => e.PreTrainedModel,
        PreTrainedTokenizer: () => l.PreTrainedTokenizer,
        PretrainedConfig: () => h.PretrainedConfig,
        PretrainedMixin: () => e.PretrainedMixin,
        Processor: () => W.Processor,
        PvtForImageClassification: () => e.PvtForImageClassification,
        PvtImageProcessor: () => g.PvtImageProcessor,
        PvtModel: () => e.PvtModel,
        PvtPreTrainedModel: () => e.PvtPreTrainedModel,
        PyAnnoteFeatureExtractor: () => _.PyAnnoteFeatureExtractor,
        PyAnnoteForAudioFrameClassification: () => e.PyAnnoteForAudioFrameClassification,
        PyAnnoteModel: () => e.PyAnnoteModel,
        PyAnnotePreTrainedModel: () => e.PyAnnotePreTrainedModel,
        PyAnnoteProcessor: () => T.PyAnnoteProcessor,
        QuestionAnsweringModelOutput: () => e.QuestionAnsweringModelOutput,
        QuestionAnsweringPipeline: () => u.QuestionAnsweringPipeline,
        Qwen2ForCausalLM: () => e.Qwen2ForCausalLM,
        Qwen2Model: () => e.Qwen2Model,
        Qwen2PreTrainedModel: () => e.Qwen2PreTrainedModel,
        Qwen2Tokenizer: () => l.Qwen2Tokenizer,
        Qwen2VLForConditionalGeneration: () => e.Qwen2VLForConditionalGeneration,
        Qwen2VLImageProcessor: () => g.Qwen2VLImageProcessor,
        Qwen2VLPreTrainedModel: () => e.Qwen2VLPreTrainedModel,
        Qwen2VLProcessor: () => T.Qwen2VLProcessor,
        Qwen3ForCausalLM: () => e.Qwen3ForCausalLM,
        Qwen3Model: () => e.Qwen3Model,
        Qwen3PreTrainedModel: () => e.Qwen3PreTrainedModel,
        RFDetrForObjectDetection: () => e.RFDetrForObjectDetection,
        RFDetrModel: () => e.RFDetrModel,
        RFDetrObjectDetectionOutput: () => e.RFDetrObjectDetectionOutput,
        RFDetrPreTrainedModel: () => e.RFDetrPreTrainedModel,
        RTDetrForObjectDetection: () => e.RTDetrForObjectDetection,
        RTDetrImageProcessor: () => g.RTDetrImageProcessor,
        RTDetrModel: () => e.RTDetrModel,
        RTDetrObjectDetectionOutput: () => e.RTDetrObjectDetectionOutput,
        RTDetrPreTrainedModel: () => e.RTDetrPreTrainedModel,
        RTDetrV2ForObjectDetection: () => e.RTDetrV2ForObjectDetection,
        RTDetrV2Model: () => e.RTDetrV2Model,
        RTDetrV2ObjectDetectionOutput: () => e.RTDetrV2ObjectDetectionOutput,
        RTDetrV2PreTrainedModel: () => e.RTDetrV2PreTrainedModel,
        RawAudio: () => b.RawAudio,
        RawImage: () => R.RawImage,
        RawVideo: () => C.RawVideo,
        RawVideoFrame: () => C.RawVideoFrame,
        RepetitionPenaltyLogitsProcessor: () => m.RepetitionPenaltyLogitsProcessor,
        ResNetForImageClassification: () => e.ResNetForImageClassification,
        ResNetModel: () => e.ResNetModel,
        ResNetPreTrainedModel: () => e.ResNetPreTrainedModel,
        RoFormerForMaskedLM: () => e.RoFormerForMaskedLM,
        RoFormerForQuestionAnswering: () => e.RoFormerForQuestionAnswering,
        RoFormerForSequenceClassification: () => e.RoFormerForSequenceClassification,
        RoFormerForTokenClassification: () => e.RoFormerForTokenClassification,
        RoFormerModel: () => e.RoFormerModel,
        RoFormerPreTrainedModel: () => e.RoFormerPreTrainedModel,
        RoFormerTokenizer: () => l.RoFormerTokenizer,
        RobertaForMaskedLM: () => e.RobertaForMaskedLM,
        RobertaForQuestionAnswering: () => e.RobertaForQuestionAnswering,
        RobertaForSequenceClassification: () => e.RobertaForSequenceClassification,
        RobertaForTokenClassification: () => e.RobertaForTokenClassification,
        RobertaModel: () => e.RobertaModel,
        RobertaPreTrainedModel: () => e.RobertaPreTrainedModel,
        RobertaTokenizer: () => l.RobertaTokenizer,
        Sam2ImageProcessor: () => g.Sam2ImageProcessor,
        Sam2ImageSegmentationOutput: () => e.Sam2ImageSegmentationOutput,
        Sam2Model: () => e.Sam2Model,
        Sam2PreTrainedModel: () => e.Sam2PreTrainedModel,
        Sam2Processor: () => T.Sam2Processor,
        Sam2VideoProcessor: () => T.Sam2VideoProcessor,
        Sam3ImageProcessor: () => g.Sam3ImageProcessor,
        Sam3TrackerModel: () => e.Sam3TrackerModel,
        SamImageProcessor: () => g.SamImageProcessor,
        SamImageSegmentationOutput: () => e.SamImageSegmentationOutput,
        SamModel: () => e.SamModel,
        SamPreTrainedModel: () => e.SamPreTrainedModel,
        SamProcessor: () => T.SamProcessor,
        SapiensForDepthEstimation: () => e.SapiensForDepthEstimation,
        SapiensForNormalEstimation: () => e.SapiensForNormalEstimation,
        SapiensForSemanticSegmentation: () => e.SapiensForSemanticSegmentation,
        SapiensPreTrainedModel: () => e.SapiensPreTrainedModel,
        SeamlessM4TFeatureExtractor: () => _.SeamlessM4TFeatureExtractor,
        SegformerFeatureExtractor: () => g.SegformerFeatureExtractor,
        SegformerForImageClassification: () => e.SegformerForImageClassification,
        SegformerForSemanticSegmentation: () => e.SegformerForSemanticSegmentation,
        SegformerImageProcessor: () => g.SegformerImageProcessor,
        SegformerModel: () => e.SegformerModel,
        SegformerPreTrainedModel: () => e.SegformerPreTrainedModel,
        Seq2SeqLMOutput: () => e.Seq2SeqLMOutput,
        SequenceClassifierOutput: () => e.SequenceClassifierOutput,
        SiglipImageProcessor: () => g.SiglipImageProcessor,
        SiglipModel: () => e.SiglipModel,
        SiglipPreTrainedModel: () => e.SiglipPreTrainedModel,
        SiglipTextModel: () => e.SiglipTextModel,
        SiglipTokenizer: () => l.SiglipTokenizer,
        SiglipVisionModel: () => e.SiglipVisionModel,
        SmolLM3ForCausalLM: () => e.SmolLM3ForCausalLM,
        SmolLM3Model: () => e.SmolLM3Model,
        SmolLM3PreTrainedModel: () => e.SmolLM3PreTrainedModel,
        SmolVLMForConditionalGeneration: () => e.SmolVLMForConditionalGeneration,
        SmolVLMImageProcessor: () => g.SmolVLMImageProcessor,
        SmolVLMProcessor: () => T.SmolVLMProcessor,
        SnacDecoderModel: () => e.SnacDecoderModel,
        SnacEncoderModel: () => e.SnacEncoderModel,
        SnacFeatureExtractor: () => _.SnacFeatureExtractor,
        SnacModel: () => e.SnacModel,
        SnacPreTrainedModel: () => e.SnacPreTrainedModel,
        SpeechT5FeatureExtractor: () => _.SpeechT5FeatureExtractor,
        SpeechT5ForSpeechToText: () => e.SpeechT5ForSpeechToText,
        SpeechT5ForTextToSpeech: () => e.SpeechT5ForTextToSpeech,
        SpeechT5HifiGan: () => e.SpeechT5HifiGan,
        SpeechT5Model: () => e.SpeechT5Model,
        SpeechT5PreTrainedModel: () => e.SpeechT5PreTrainedModel,
        SpeechT5Processor: () => T.SpeechT5Processor,
        SpeechT5Tokenizer: () => l.SpeechT5Tokenizer,
        SqueezeBertForMaskedLM: () => e.SqueezeBertForMaskedLM,
        SqueezeBertForQuestionAnswering: () => e.SqueezeBertForQuestionAnswering,
        SqueezeBertForSequenceClassification: () => e.SqueezeBertForSequenceClassification,
        SqueezeBertModel: () => e.SqueezeBertModel,
        SqueezeBertPreTrainedModel: () => e.SqueezeBertPreTrainedModel,
        SqueezeBertTokenizer: () => l.SqueezeBertTokenizer,
        StableLmForCausalLM: () => e.StableLmForCausalLM,
        StableLmModel: () => e.StableLmModel,
        StableLmPreTrainedModel: () => e.StableLmPreTrainedModel,
        Starcoder2ForCausalLM: () => e.Starcoder2ForCausalLM,
        Starcoder2Model: () => e.Starcoder2Model,
        Starcoder2PreTrainedModel: () => e.Starcoder2PreTrainedModel,
        StoppingCriteria: () => p.StoppingCriteria,
        StoppingCriteriaList: () => p.StoppingCriteriaList,
        StyleTextToSpeech2Model: () => e.StyleTextToSpeech2Model,
        StyleTextToSpeech2PreTrainedModel: () => e.StyleTextToSpeech2PreTrainedModel,
        SummarizationPipeline: () => u.SummarizationPipeline,
        SupertonicForConditionalGeneration: () => e.SupertonicForConditionalGeneration,
        SupertonicPreTrainedModel: () => e.SupertonicPreTrainedModel,
        SuppressTokensAtBeginLogitsProcessor: () => m.SuppressTokensAtBeginLogitsProcessor,
        Swin2SRForImageSuperResolution: () => e.Swin2SRForImageSuperResolution,
        Swin2SRImageProcessor: () => g.Swin2SRImageProcessor,
        Swin2SRModel: () => e.Swin2SRModel,
        Swin2SRPreTrainedModel: () => e.Swin2SRPreTrainedModel,
        SwinForImageClassification: () => e.SwinForImageClassification,
        SwinForSemanticSegmentation: () => e.SwinForSemanticSegmentation,
        SwinModel: () => e.SwinModel,
        SwinPreTrainedModel: () => e.SwinPreTrainedModel,
        T5ForConditionalGeneration: () => e.T5ForConditionalGeneration,
        T5Model: () => e.T5Model,
        T5PreTrainedModel: () => e.T5PreTrainedModel,
        T5Tokenizer: () => l.T5Tokenizer,
        TableTransformerForObjectDetection: () => e.TableTransformerForObjectDetection,
        TableTransformerModel: () => e.TableTransformerModel,
        TableTransformerObjectDetectionOutput: () => e.TableTransformerObjectDetectionOutput,
        TableTransformerPreTrainedModel: () => e.TableTransformerPreTrainedModel,
        TemperatureLogitsWarper: () => m.TemperatureLogitsWarper,
        Tensor: () => M.Tensor,
        Text2TextGenerationPipeline: () => u.Text2TextGenerationPipeline,
        TextClassificationPipeline: () => u.TextClassificationPipeline,
        TextGenerationPipeline: () => u.TextGenerationPipeline,
        TextStreamer: () => I.TextStreamer,
        TextToAudioPipeline: () => u.TextToAudioPipeline,
        TokenClassificationPipeline: () => u.TokenClassificationPipeline,
        TokenClassifierOutput: () => e.TokenClassifierOutput,
        TokenizerModel: () => l.TokenizerModel,
        TopKLogitsWarper: () => m.TopKLogitsWarper,
        TopPLogitsWarper: () => m.TopPLogitsWarper,
        TrOCRForCausalLM: () => e.TrOCRForCausalLM,
        TrOCRPreTrainedModel: () => e.TrOCRPreTrainedModel,
        TranslationPipeline: () => u.TranslationPipeline,
        UltravoxModel: () => e.UltravoxModel,
        UltravoxPreTrainedModel: () => e.UltravoxPreTrainedModel,
        UltravoxProcessor: () => T.UltravoxProcessor,
        UniSpeechForCTC: () => e.UniSpeechForCTC,
        UniSpeechForSequenceClassification: () => e.UniSpeechForSequenceClassification,
        UniSpeechModel: () => e.UniSpeechModel,
        UniSpeechPreTrainedModel: () => e.UniSpeechPreTrainedModel,
        UniSpeechSatForAudioFrameClassification: () => e.UniSpeechSatForAudioFrameClassification,
        UniSpeechSatForCTC: () => e.UniSpeechSatForCTC,
        UniSpeechSatForSequenceClassification: () => e.UniSpeechSatForSequenceClassification,
        UniSpeechSatModel: () => e.UniSpeechSatModel,
        UniSpeechSatPreTrainedModel: () => e.UniSpeechSatPreTrainedModel,
        VLChatProcessor: () => T.VLChatProcessor,
        VLMImageProcessor: () => g.VLMImageProcessor,
        VaultGemmaForCausalLM: () => e.VaultGemmaForCausalLM,
        VaultGemmaModel: () => e.VaultGemmaModel,
        VaultGemmaPreTrainedModel: () => e.VaultGemmaPreTrainedModel,
        ViTFeatureExtractor: () => g.ViTFeatureExtractor,
        ViTForImageClassification: () => e.ViTForImageClassification,
        ViTImageProcessor: () => g.ViTImageProcessor,
        ViTMAEModel: () => e.ViTMAEModel,
        ViTMAEPreTrainedModel: () => e.ViTMAEPreTrainedModel,
        ViTMSNForImageClassification: () => e.ViTMSNForImageClassification,
        ViTMSNModel: () => e.ViTMSNModel,
        ViTMSNPreTrainedModel: () => e.ViTMSNPreTrainedModel,
        ViTModel: () => e.ViTModel,
        ViTPreTrainedModel: () => e.ViTPreTrainedModel,
        VisionEncoderDecoderModel: () => e.VisionEncoderDecoderModel,
        VitMatteForImageMatting: () => e.VitMatteForImageMatting,
        VitMatteImageProcessor: () => g.VitMatteImageProcessor,
        VitMattePreTrainedModel: () => e.VitMattePreTrainedModel,
        VitPoseForPoseEstimation: () => e.VitPoseForPoseEstimation,
        VitPoseImageProcessor: () => g.VitPoseImageProcessor,
        VitPosePreTrainedModel: () => e.VitPosePreTrainedModel,
        VitsModel: () => e.VitsModel,
        VitsModelOutput: () => e.VitsModelOutput,
        VitsPreTrainedModel: () => e.VitsPreTrainedModel,
        VitsTokenizer: () => l.VitsTokenizer,
        VoxtralForConditionalGeneration: () => e.VoxtralForConditionalGeneration,
        VoxtralProcessor: () => T.VoxtralProcessor,
        Wav2Vec2BertForCTC: () => e.Wav2Vec2BertForCTC,
        Wav2Vec2BertForSequenceClassification: () => e.Wav2Vec2BertForSequenceClassification,
        Wav2Vec2BertModel: () => e.Wav2Vec2BertModel,
        Wav2Vec2BertPreTrainedModel: () => e.Wav2Vec2BertPreTrainedModel,
        Wav2Vec2CTCTokenizer: () => l.Wav2Vec2CTCTokenizer,
        Wav2Vec2FeatureExtractor: () => _.Wav2Vec2FeatureExtractor,
        Wav2Vec2ForAudioFrameClassification: () => e.Wav2Vec2ForAudioFrameClassification,
        Wav2Vec2ForCTC: () => e.Wav2Vec2ForCTC,
        Wav2Vec2ForSequenceClassification: () => e.Wav2Vec2ForSequenceClassification,
        Wav2Vec2Model: () => e.Wav2Vec2Model,
        Wav2Vec2PreTrainedModel: () => e.Wav2Vec2PreTrainedModel,
        Wav2Vec2Processor: () => T.Wav2Vec2Processor,
        Wav2Vec2ProcessorWithLM: () => T.Wav2Vec2ProcessorWithLM,
        WavLMForAudioFrameClassification: () => e.WavLMForAudioFrameClassification,
        WavLMForCTC: () => e.WavLMForCTC,
        WavLMForSequenceClassification: () => e.WavLMForSequenceClassification,
        WavLMForXVector: () => e.WavLMForXVector,
        WavLMModel: () => e.WavLMModel,
        WavLMPreTrainedModel: () => e.WavLMPreTrainedModel,
        WeSpeakerFeatureExtractor: () => _.WeSpeakerFeatureExtractor,
        WeSpeakerResNetModel: () => e.WeSpeakerResNetModel,
        WeSpeakerResNetPreTrainedModel: () => e.WeSpeakerResNetPreTrainedModel,
        WhisperFeatureExtractor: () => _.WhisperFeatureExtractor,
        WhisperForConditionalGeneration: () => e.WhisperForConditionalGeneration,
        WhisperModel: () => e.WhisperModel,
        WhisperPreTrainedModel: () => e.WhisperPreTrainedModel,
        WhisperProcessor: () => T.WhisperProcessor,
        WhisperTextStreamer: () => I.WhisperTextStreamer,
        WhisperTimeStampLogitsProcessor: () => m.WhisperTimeStampLogitsProcessor,
        WhisperTokenizer: () => l.WhisperTokenizer,
        XLMForQuestionAnswering: () => e.XLMForQuestionAnswering,
        XLMForSequenceClassification: () => e.XLMForSequenceClassification,
        XLMForTokenClassification: () => e.XLMForTokenClassification,
        XLMModel: () => e.XLMModel,
        XLMPreTrainedModel: () => e.XLMPreTrainedModel,
        XLMRobertaForMaskedLM: () => e.XLMRobertaForMaskedLM,
        XLMRobertaForQuestionAnswering: () => e.XLMRobertaForQuestionAnswering,
        XLMRobertaForSequenceClassification: () => e.XLMRobertaForSequenceClassification,
        XLMRobertaForTokenClassification: () => e.XLMRobertaForTokenClassification,
        XLMRobertaModel: () => e.XLMRobertaModel,
        XLMRobertaPreTrainedModel: () => e.XLMRobertaPreTrainedModel,
        XLMRobertaTokenizer: () => l.XLMRobertaTokenizer,
        XLMTokenizer: () => l.XLMTokenizer,
        XLMWithLMHeadModel: () => e.XLMWithLMHeadModel,
        XVectorOutput: () => e.XVectorOutput,
        YolosFeatureExtractor: () => g.YolosFeatureExtractor,
        YolosForObjectDetection: () => e.YolosForObjectDetection,
        YolosImageProcessor: () => g.YolosImageProcessor,
        YolosModel: () => e.YolosModel,
        YolosObjectDetectionOutput: () => e.YolosObjectDetectionOutput,
        YolosPreTrainedModel: () => e.YolosPreTrainedModel,
        ZeroShotAudioClassificationPipeline: () => u.ZeroShotAudioClassificationPipeline,
        ZeroShotClassificationPipeline: () => u.ZeroShotClassificationPipeline,
        ZeroShotImageClassificationPipeline: () => u.ZeroShotImageClassificationPipeline,
        ZeroShotObjectDetectionPipeline: () => u.ZeroShotObjectDetectionPipeline,
        bankers_round: () => f.bankers_round,
        cat: () => M.cat,
        cos_sim: () => f.cos_sim,
        dot: () => f.dot,
        dynamic_time_warping: () => f.dynamic_time_warping,
        env: () => de.env,
        full: () => M.full,
        full_like: () => M.full_like,
        getCacheShapes: () => h.getCacheShapes,
        hamming: () => b.hamming,
        hanning: () => b.hanning,
        interpolate: () => M.interpolate,
        interpolate_4d: () => M.interpolate_4d,
        interpolate_data: () => f.interpolate_data,
        is_chinese_char: () => l.is_chinese_char,
        layer_norm: () => M.layer_norm,
        load_image: () => R.load_image,
        load_video: () => C.load_video,
        log_softmax: () => f.log_softmax,
        magnitude: () => f.magnitude,
        matmul: () => M.matmul,
        max: () => f.max,
        mean: () => M.mean,
        mean_pooling: () => M.mean_pooling,
        medianFilter: () => f.medianFilter,
        mel_filter_bank: () => b.mel_filter_bank,
        min: () => f.min,
        ones: () => M.ones,
        ones_like: () => M.ones_like,
        permute: () => M.permute,
        permute_data: () => f.permute_data,
        pipeline: () => u.pipeline,
        quantize_embeddings: () => M.quantize_embeddings,
        rand: () => M.rand,
        randn: () => M.randn,
        read_audio: () => b.read_audio,
        rfft: () => M.rfft,
        round: () => f.round,
        slice: () => M.slice,
        softmax: () => f.softmax,
        spectrogram: () => b.spectrogram,
        stack: () => M.stack,
        std_mean: () => M.std_mean,
        topk: () => M.topk,
        window_function: () => b.window_function,
        zeros: () => M.zeros,
        zeros_like: () => M.zeros_like
    });
    var de = pt("./src/env.js")
      , u = pt("./src/pipelines.js")
      , e = pt("./src/models.js")
      , l = pt("./src/tokenizers.js")
      , h = pt("./src/configs.js")
      , b = pt("./src/utils/audio.js")
      , R = pt("./src/utils/image.js")
      , C = pt("./src/utils/video.js")
      , M = pt("./src/utils/tensor.js")
      , f = pt("./src/utils/maths.js")
      , L = pt("./src/base/feature_extraction_utils.js")
      , _ = pt("./src/models/feature_extractors.js")
      , a = pt("./src/models/auto/feature_extraction_auto.js")
      , v = pt("./src/base/image_processors_utils.js")
      , g = pt("./src/models/image_processors.js")
      , y = pt("./src/models/auto/image_processing_auto.js")
      , W = pt("./src/base/processing_utils.js")
      , T = pt("./src/models/processors.js")
      , k = pt("./src/models/auto/processing_auto.js")
      , I = pt("./src/generation/streamers.js")
      , p = pt("./src/generation/stopping_criteria.js")
      , m = pt("./src/generation/logits_process.js")
}
)();
var Nu = t.ASTFeatureExtractor
  , Vu = t.ASTForAudioClassification
  , Ru = t.ASTModel
  , zu = t.ASTPreTrainedModel
  , Gu = t.AlbertForMaskedLM
  , Wu = t.AlbertForQuestionAnswering
  , Uu = t.AlbertForSequenceClassification
  , Ku = t.AlbertModel
  , $u = t.AlbertPreTrainedModel
  , Qu = t.AlbertTokenizer
  , Xu = t.ArceeForCausalLM
  , Hu = t.ArceeModel
  , Ju = t.ArceePreTrainedModel
  , Yu = t.AudioClassificationPipeline
  , qu = t.AutoConfig
  , Zu = t.AutoFeatureExtractor
  , ep = t.AutoImageProcessor
  , tp = t.AutoModel
  , sp = t.AutoModelForAudioClassification
  , rp = t.AutoModelForAudioFrameClassification
  , op = t.AutoModelForAudioTextToText
  , ap = t.AutoModelForCTC
  , np = t.AutoModelForCausalLM
  , ip = t.AutoModelForDepthEstimation
  , lp = t.AutoModelForDocumentQuestionAnswering
  , cp = t.AutoModelForImageClassification
  , _p = t.AutoModelForImageFeatureExtraction
  , dp = t.AutoModelForImageMatting
  , up = t.AutoModelForImageSegmentation
  , pp = t.AutoModelForImageTextToText
  , mp = t.AutoModelForImageToImage
  , Mp = t.AutoModelForMaskGeneration
  , hp = t.AutoModelForMaskedLM
  , fp = t.AutoModelForNormalEstimation
  , gp = t.AutoModelForObjectDetection
  , Pp = t.AutoModelForPoseEstimation
  , Tp = t.AutoModelForQuestionAnswering
  , wp = t.AutoModelForSemanticSegmentation
  , bp = t.AutoModelForSeq2SeqLM
  , xp = t.AutoModelForSequenceClassification
  , vp = t.AutoModelForSpeechSeq2Seq
  , Ep = t.AutoModelForTextToSpectrogram
  , Fp = t.AutoModelForTextToWaveform
  , kp = t.AutoModelForTokenClassification
  , Cp = t.AutoModelForUniversalSegmentation
  , Sp = t.AutoModelForVision2Seq
  , Lp = t.AutoModelForXVector
  , Ap = t.AutoModelForZeroShotObjectDetection
  , yp = t.AutoProcessor
  , Dp = t.AutoTokenizer
  , Ip = t.AutomaticSpeechRecognitionPipeline
  , Op = t.BackgroundRemovalPipeline
  , Bp = t.BartForConditionalGeneration
  , jp = t.BartForSequenceClassification
  , Np = t.BartModel
  , Vp = t.BartPretrainedModel
  , Rp = t.BartTokenizer
  , zp = t.BaseModelOutput
  , Gp = t.BaseStreamer
  , Wp = t.BeitFeatureExtractor
  , Up = t.BeitForImageClassification
  , Kp = t.BeitModel
  , $p = t.BeitPreTrainedModel
  , Qp = t.BertForMaskedLM
  , Xp = t.BertForQuestionAnswering
  , Hp = t.BertForSequenceClassification
  , Jp = t.BertForTokenClassification
  , Yp = t.BertModel
  , qp = t.BertPreTrainedModel
  , Zp = t.BertTokenizer
  , em = t.BitImageProcessor
  , tm = t.BlenderbotForConditionalGeneration
  , sm = t.BlenderbotModel
  , rm = t.BlenderbotPreTrainedModel
  , om = t.BlenderbotSmallForConditionalGeneration
  , am = t.BlenderbotSmallModel
  , nm = t.BlenderbotSmallPreTrainedModel
  , im = t.BlenderbotSmallTokenizer
  , lm = t.BlenderbotTokenizer
  , cm = t.BloomForCausalLM
  , _m = t.BloomModel
  , dm = t.BloomPreTrainedModel
  , um = t.BloomTokenizer
  , pm = t.CLIPFeatureExtractor
  , mm = t.CLIPImageProcessor
  , Mm = t.CLIPModel
  , hm = t.CLIPPreTrainedModel
  , fm = t.CLIPSegForImageSegmentation
  , gm = t.CLIPSegModel
  , Pm = t.CLIPSegPreTrainedModel
  , Tm = t.CLIPTextModel
  , wm = t.CLIPTextModelWithProjection
  , bm = t.CLIPTokenizer
  , xm = t.CLIPVisionModel
  , vm = t.CLIPVisionModelWithProjection
  , Em = t.CamembertForMaskedLM
  , Fm = t.CamembertForQuestionAnswering
  , km = t.CamembertForSequenceClassification
  , Cm = t.CamembertForTokenClassification
  , Sm = t.CamembertModel
  , Lm = t.CamembertPreTrainedModel
  , Am = t.CamembertTokenizer
  , ym = t.CausalLMOutput
  , Dm = t.CausalLMOutputWithPast
  , Im = t.ChineseCLIPFeatureExtractor
  , Om = t.ChineseCLIPModel
  , Bm = t.ChineseCLIPPreTrainedModel
  , jm = t.ClapAudioModelWithProjection
  , Nm = t.ClapFeatureExtractor
  , Vm = t.ClapModel
  , Rm = t.ClapPreTrainedModel
  , zm = t.ClapTextModelWithProjection
  , Gm = t.ClassifierFreeGuidanceLogitsProcessor
  , Wm = t.CodeGenForCausalLM
  , Um = t.CodeGenModel
  , Km = t.CodeGenPreTrainedModel
  , $m = t.CodeGenTokenizer
  , Qm = t.CodeLlamaTokenizer
  , Xm = t.CohereForCausalLM
  , Hm = t.CohereModel
  , Jm = t.CoherePreTrainedModel
  , Ym = t.CohereTokenizer
  , qm = t.ConvBertForMaskedLM
  , Zm = t.ConvBertForQuestionAnswering
  , eM = t.ConvBertForSequenceClassification
  , tM = t.ConvBertForTokenClassification
  , sM = t.ConvBertModel
  , rM = t.ConvBertPreTrainedModel
  , oM = t.ConvBertTokenizer
  , aM = t.ConvNextFeatureExtractor
  , nM = t.ConvNextForImageClassification
  , iM = t.ConvNextImageProcessor
  , lM = t.ConvNextModel
  , cM = t.ConvNextPreTrainedModel
  , _M = t.ConvNextV2ForImageClassification
  , dM = t.ConvNextV2Model
  , uM = t.ConvNextV2PreTrainedModel
  , pM = t.DFineForObjectDetection
  , mM = t.DFineModel
  , MM = t.DFinePreTrainedModel
  , hM = t.DINOv3ConvNextModel
  , fM = t.DINOv3ConvNextPreTrainedModel
  , gM = t.DINOv3ViTImageProcessor
  , PM = t.DINOv3ViTModel
  , TM = t.DINOv3ViTPreTrainedModel
  , wM = t.DPTFeatureExtractor
  , bM = t.DPTForDepthEstimation
  , xM = t.DPTImageProcessor
  , vM = t.DPTModel
  , EM = t.DPTPreTrainedModel
  , FM = t.DacDecoderModel
  , kM = t.DacDecoderOutput
  , CM = t.DacEncoderModel
  , SM = t.DacEncoderOutput
  , LM = t.DacFeatureExtractor
  , AM = t.DacModel
  , yM = t.DacPreTrainedModel
  , DM = t.DataTypeMap
  , IM = t.DebertaForMaskedLM
  , OM = t.DebertaForQuestionAnswering
  , BM = t.DebertaForSequenceClassification
  , jM = t.DebertaForTokenClassification
  , NM = t.DebertaModel
  , VM = t.DebertaPreTrainedModel
  , RM = t.DebertaTokenizer
  , zM = t.DebertaV2ForMaskedLM
  , GM = t.DebertaV2ForQuestionAnswering
  , WM = t.DebertaV2ForSequenceClassification
  , UM = t.DebertaV2ForTokenClassification
  , KM = t.DebertaV2Model
  , $M = t.DebertaV2PreTrainedModel
  , QM = t.DebertaV2Tokenizer
  , XM = t.DecisionTransformerModel
  , HM = t.DecisionTransformerPreTrainedModel
  , JM = t.DeiTFeatureExtractor
  , YM = t.DeiTForImageClassification
  , qM = t.DeiTImageProcessor
  , ZM = t.DeiTModel
  , eh = t.DeiTPreTrainedModel
  , th = t.DepthAnythingForDepthEstimation
  , sh = t.DepthAnythingPreTrainedModel
  , rh = t.DepthEstimationPipeline
  , oh = t.DepthProForDepthEstimation
  , ah = t.DepthProPreTrainedModel
  , nh = t.DetrFeatureExtractor
  , ih = t.DetrForObjectDetection
  , lh = t.DetrForSegmentation
  , ch = t.DetrImageProcessor
  , _h = t.DetrModel
  , dh = t.DetrObjectDetectionOutput
  , uh = t.DetrPreTrainedModel
  , ph = t.DetrSegmentationOutput
  , mh = t.Dinov2ForImageClassification
  , Mh = t.Dinov2Model
  , hh = t.Dinov2PreTrainedModel
  , fh = t.Dinov2WithRegistersForImageClassification
  , gh = t.Dinov2WithRegistersModel
  , Ph = t.Dinov2WithRegistersPreTrainedModel
  , Th = t.DistilBertForMaskedLM
  , wh = t.DistilBertForQuestionAnswering
  , bh = t.DistilBertForSequenceClassification
  , xh = t.DistilBertForTokenClassification
  , vh = t.DistilBertModel
  , Eh = t.DistilBertPreTrainedModel
  , Fh = t.DistilBertTokenizer
  , kh = t.DocumentQuestionAnsweringPipeline
  , Ch = t.DonutFeatureExtractor
  , Sh = t.DonutImageProcessor
  , Lh = t.DonutSwinModel
  , Ah = t.DonutSwinPreTrainedModel
  , yh = t.EdgeTamModel
  , Dh = t.EfficientNetForImageClassification
  , Ih = t.EfficientNetImageProcessor
  , Oh = t.EfficientNetModel
  , Bh = t.EfficientNetPreTrainedModel
  , jh = t.ElectraForMaskedLM
  , Nh = t.ElectraForQuestionAnswering
  , Vh = t.ElectraForSequenceClassification
  , Rh = t.ElectraForTokenClassification
  , zh = t.ElectraModel
  , Gh = t.ElectraPreTrainedModel
  , Wh = t.ElectraTokenizer
  , Uh = t.EncodecFeatureExtractor
  , Kh = t.EosTokenCriteria
  , $h = t.Ernie4_5_ForCausalLM
  , Qh = t.Ernie4_5_Model
  , Xh = t.Ernie4_5_PretrainedModel
  , Hh = t.Ernie4_5_Tokenizer
  , Jh = t.EsmForMaskedLM
  , Yh = t.EsmForSequenceClassification
  , qh = t.EsmForTokenClassification
  , Zh = t.EsmModel
  , ef = t.EsmPreTrainedModel
  , tf = t.EsmTokenizer
  , sf = t.ExaoneForCausalLM
  , rf = t.ExaoneModel
  , of = t.ExaonePreTrainedModel
  , af = t.FFT
  , nf = t.FalconForCausalLM
  , lf = t.FalconModel
  , cf = t.FalconPreTrainedModel
  , _f = t.FalconTokenizer
  , df = t.FastViTForImageClassification
  , uf = t.FastViTModel
  , pf = t.FastViTPreTrainedModel
  , mf = t.FeatureExtractionPipeline
  , Mf = t.FeatureExtractor
  , hf = t.FillMaskPipeline
  , ff = t.Florence2ForConditionalGeneration
  , gf = t.Florence2PreTrainedModel
  , Pf = t.Florence2Processor
  , Tf = t.ForcedBOSTokenLogitsProcessor
  , wf = t.ForcedEOSTokenLogitsProcessor
  , bf = t.GLPNFeatureExtractor
  , xf = t.GLPNForDepthEstimation
  , vf = t.GLPNModel
  , Ef = t.GLPNPreTrainedModel
  , Ff = t.GPT2LMHeadModel
  , kf = t.GPT2Model
  , Cf = t.GPT2PreTrainedModel
  , Sf = t.GPT2Tokenizer
  , Lf = t.GPTBigCodeForCausalLM
  , Af = t.GPTBigCodeModel
  , yf = t.GPTBigCodePreTrainedModel
  , Df = t.GPTJForCausalLM
  , If = t.GPTJModel
  , Of = t.GPTJPreTrainedModel
  , Bf = t.GPTNeoForCausalLM
  , jf = t.GPTNeoModel
  , Nf = t.GPTNeoPreTrainedModel
  , Vf = t.GPTNeoXForCausalLM
  , Rf = t.GPTNeoXModel
  , zf = t.GPTNeoXPreTrainedModel
  , Gf = t.GPTNeoXTokenizer
  , Wf = t.Gemma2ForCausalLM
  , Uf = t.Gemma2Model
  , Kf = t.Gemma2PreTrainedModel
  , $f = t.Gemma3ForCausalLM
  , Qf = t.Gemma3Model
  , Xf = t.Gemma3PreTrainedModel
  , Hf = t.Gemma3nAudioFeatureExtractor
  , Jf = t.Gemma3nForConditionalGeneration
  , Yf = t.Gemma3nPreTrainedModel
  , qf = t.Gemma3nProcessor
  , Zf = t.GemmaForCausalLM
  , eg = t.GemmaModel
  , tg = t.GemmaPreTrainedModel
  , sg = t.GemmaTokenizer
  , rg = t.GlmForCausalLM
  , og = t.GlmModel
  , ag = t.GlmPreTrainedModel
  , ng = t.GraniteForCausalLM
  , ig = t.GraniteModel
  , lg = t.GraniteMoeHybridForCausalLM
  , cg = t.GraniteMoeHybridModel
  , _g = t.GraniteMoeHybridPreTrainedModel
  , dg = t.GranitePreTrainedModel
  , ug = t.Grok1Tokenizer
  , pg = t.GroundingDinoForObjectDetection
  , mg = t.GroundingDinoImageProcessor
  , Mg = t.GroundingDinoPreTrainedModel
  , hg = t.GroundingDinoProcessor
  , fg = t.GroupViTModel
  , gg = t.GroupViTPreTrainedModel
  , Pg = t.HeliumForCausalLM
  , Tg = t.HeliumModel
  , wg = t.HeliumPreTrainedModel
  , bg = t.HerbertTokenizer
  , xg = t.HieraForImageClassification
  , vg = t.HieraModel
  , Eg = t.HieraPreTrainedModel
  , Fg = t.HubertForCTC
  , kg = t.HubertForSequenceClassification
  , Cg = t.HubertModel
  , Sg = t.HubertPreTrainedModel
  , Lg = t.IJepaForImageClassification
  , Ag = t.IJepaModel
  , yg = t.IJepaPreTrainedModel
  , Dg = t.Idefics3ForConditionalGeneration
  , Ig = t.Idefics3ImageProcessor
  , Og = t.Idefics3PreTrainedModel
  , Bg = t.Idefics3Processor
  , jg = t.ImageClassificationPipeline
  , Ng = t.ImageFeatureExtractionPipeline
  , Vg = t.ImageFeatureExtractor
  , Rg = t.ImageMattingOutput
  , zg = t.ImageProcessor
  , Gg = t.ImageSegmentationPipeline
  , Wg = t.ImageToImagePipeline
  , Ug = t.ImageToTextPipeline
  , Kg = t.InterruptableStoppingCriteria
  , $g = t.JAISLMHeadModel
  , Qg = t.JAISModel
  , Xg = t.JAISPreTrainedModel
  , Hg = t.JinaCLIPImageProcessor
  , Jg = t.JinaCLIPModel
  , Yg = t.JinaCLIPPreTrainedModel
  , qg = t.JinaCLIPProcessor
  , Zg = t.JinaCLIPTextModel
  , eP = t.JinaCLIPVisionModel
  , tP = t.Lfm2ForCausalLM
  , sP = t.Lfm2Model
  , rP = t.Lfm2PreTrainedModel
  , oP = t.LiteWhisperForConditionalGeneration
  , aP = t.Llama4ForCausalLM
  , nP = t.Llama4PreTrainedModel
  , iP = t.LlamaForCausalLM
  , lP = t.LlamaModel
  , cP = t.LlamaPreTrainedModel
  , _P = t.LlamaTokenizer
  , dP = t.LlavaForConditionalGeneration
  , uP = t.LlavaOnevisionForConditionalGeneration
  , pP = t.LlavaOnevisionImageProcessor
  , mP = t.LlavaPreTrainedModel
  , MP = t.LlavaProcessor
  , hP = t.LlavaQwen2ForCausalLM
  , fP = t.LogitsProcessor
  , gP = t.LogitsProcessorList
  , PP = t.LogitsWarper
  , TP = t.LongT5ForConditionalGeneration
  , wP = t.LongT5Model
  , bP = t.LongT5PreTrainedModel
  , xP = t.M2M100ForConditionalGeneration
  , vP = t.M2M100Model
  , EP = t.M2M100PreTrainedModel
  , FP = t.M2M100Tokenizer
  , kP = t.MBart50Tokenizer
  , CP = t.MBartForCausalLM
  , SP = t.MBartForConditionalGeneration
  , LP = t.MBartForSequenceClassification
  , AP = t.MBartModel
  , yP = t.MBartPreTrainedModel
  , DP = t.MBartTokenizer
  , IP = t.MPNetForMaskedLM
  , OP = t.MPNetForQuestionAnswering
  , BP = t.MPNetForSequenceClassification
  , jP = t.MPNetForTokenClassification
  , NP = t.MPNetModel
  , VP = t.MPNetPreTrainedModel
  , RP = t.MPNetTokenizer
  , zP = t.MT5ForConditionalGeneration
  , GP = t.MT5Model
  , WP = t.MT5PreTrainedModel
  , UP = t.MarianMTModel
  , KP = t.MarianModel
  , $P = t.MarianPreTrainedModel
  , QP = t.MarianTokenizer
  , XP = t.Mask2FormerImageProcessor
  , HP = t.MaskFormerFeatureExtractor
  , JP = t.MaskFormerForInstanceSegmentation
  , YP = t.MaskFormerImageProcessor
  , qP = t.MaskFormerModel
  , ZP = t.MaskFormerPreTrainedModel
  , eT = t.MaskedLMOutput
  , tT = t.MaxLengthCriteria
  , sT = t.Metric3DForDepthEstimation
  , rT = t.Metric3DPreTrainedModel
  , oT = t.Metric3Dv2ForDepthEstimation
  , aT = t.Metric3Dv2PreTrainedModel
  , nT = t.MgpstrForSceneTextRecognition
  , iT = t.MgpstrModelOutput
  , lT = t.MgpstrPreTrainedModel
  , cT = t.MgpstrProcessor
  , _T = t.MgpstrTokenizer
  , dT = t.MimiDecoderModel
  , uT = t.MimiDecoderOutput
  , pT = t.MimiEncoderModel
  , mT = t.MimiEncoderOutput
  , MT = t.MimiModel
  , hT = t.MimiPreTrainedModel
  , fT = t.MinLengthLogitsProcessor
  , gT = t.MinNewTokensLengthLogitsProcessor
  , PT = t.MistralForCausalLM
  , TT = t.MistralModel
  , wT = t.MistralPreTrainedModel
  , bT = t.MobileBertForMaskedLM
  , xT = t.MobileBertForQuestionAnswering
  , vT = t.MobileBertForSequenceClassification
  , ET = t.MobileBertModel
  , FT = t.MobileBertPreTrainedModel
  , kT = t.MobileBertTokenizer
  , CT = t.MobileLLMForCausalLM
  , ST = t.MobileLLMModel
  , LT = t.MobileLLMPreTrainedModel
  , AT = t.MobileNetV1FeatureExtractor
  , yT = t.MobileNetV1ForImageClassification
  , DT = t.MobileNetV1ForSemanticSegmentation
  , IT = t.MobileNetV1ImageProcessor
  , OT = t.MobileNetV1Model
  , BT = t.MobileNetV1PreTrainedModel
  , jT = t.MobileNetV2FeatureExtractor
  , NT = t.MobileNetV2ForImageClassification
  , VT = t.MobileNetV2ForSemanticSegmentation
  , RT = t.MobileNetV2ImageProcessor
  , zT = t.MobileNetV2Model
  , GT = t.MobileNetV2PreTrainedModel
  , WT = t.MobileNetV3FeatureExtractor
  , UT = t.MobileNetV3ForImageClassification
  , KT = t.MobileNetV3ForSemanticSegmentation
  , $T = t.MobileNetV3ImageProcessor
  , QT = t.MobileNetV3Model
  , XT = t.MobileNetV3PreTrainedModel
  , HT = t.MobileNetV4FeatureExtractor
  , JT = t.MobileNetV4ForImageClassification
  , YT = t.MobileNetV4ForSemanticSegmentation
  , qT = t.MobileNetV4ImageProcessor
  , ZT = t.MobileNetV4Model
  , ew = t.MobileNetV4PreTrainedModel
  , tw = t.MobileViTFeatureExtractor
  , sw = t.MobileViTForImageClassification
  , rw = t.MobileViTImageProcessor
  , ow = t.MobileViTModel
  , aw = t.MobileViTPreTrainedModel
  , nw = t.MobileViTV2ForImageClassification
  , iw = t.MobileViTV2Model
  , lw = t.MobileViTV2PreTrainedModel
  , cw = t.ModelOutput
  , _w = t.ModernBertDecoderForCausalLM
  , dw = t.ModernBertDecoderModel
  , uw = t.ModernBertDecoderPreTrainedModel
  , pw = t.ModernBertForMaskedLM
  , mw = t.ModernBertForSequenceClassification
  , Mw = t.ModernBertForTokenClassification
  , hw = t.ModernBertModel
  , fw = t.ModernBertPreTrainedModel
  , gw = t.Moondream1ForConditionalGeneration
  , Pw = t.MoonshineFeatureExtractor
  , Tw = t.MoonshineForConditionalGeneration
  , ww = t.MoonshineModel
  , bw = t.MoonshinePreTrainedModel
  , xw = t.MoonshineProcessor
  , vw = t.MptForCausalLM
  , Ew = t.MptModel
  , Fw = t.MptPreTrainedModel
  , kw = t.MultiModalityCausalLM
  , Cw = t.MultiModalityPreTrainedModel
  , Sw = t.MusicgenForCausalLM
  , Lw = t.MusicgenForConditionalGeneration
  , Aw = t.MusicgenModel
  , yw = t.MusicgenPreTrainedModel
  , Dw = t.NanoChatForCausalLM
  , Iw = t.NanoChatModel
  , Ow = t.NanoChatPreTrainedModel
  , Bw = t.NeoBertForMaskedLM
  , jw = t.NeoBertForQuestionAnswering
  , Nw = t.NeoBertForSequenceClassification
  , Vw = t.NeoBertForTokenClassification
  , Rw = t.NeoBertModel
  , zw = t.NeoBertPreTrainedModel
  , Gw = t.NllbTokenizer
  , Ww = t.NoBadWordsLogitsProcessor
  , Uw = t.NoRepeatNGramLogitsProcessor
  , Kw = t.NomicBertModel
  , $w = t.NomicBertPreTrainedModel
  , Qw = t.NougatImageProcessor
  , Xw = t.NougatTokenizer
  , Hw = t.OPTForCausalLM
  , Jw = t.OPTModel
  , Yw = t.OPTPreTrainedModel
  , qw = t.ObjectDetectionPipeline
  , Zw = t.Olmo2ForCausalLM
  , eb = t.Olmo2Model
  , tb = t.Olmo2PreTrainedModel
  , sb = t.OlmoForCausalLM
  , rb = t.OlmoModel
  , ob = t.OlmoPreTrainedModel
  , ab = t.OpenELMForCausalLM
  , nb = t.OpenELMModel
  , ib = t.OpenELMPreTrainedModel
  , lb = t.OwlViTFeatureExtractor
  , cb = t.OwlViTForObjectDetection
  , _b = t.OwlViTImageProcessor
  , db = t.OwlViTModel
  , ub = t.OwlViTPreTrainedModel
  , pb = t.OwlViTProcessor
  , mb = t.Owlv2ForObjectDetection
  , Mb = t.Owlv2ImageProcessor
  , hb = t.Owlv2Model
  , fb = t.Owlv2PreTrainedModel
  , gb = t.PaliGemmaForConditionalGeneration
  , Pb = t.PaliGemmaPreTrainedModel
  , Tb = t.PaliGemmaProcessor
  , wb = t.ParakeetFeatureExtractor
  , bb = t.ParakeetForCTC
  , xb = t.ParakeetPreTrainedModel
  , vb = t.PatchTSMixerForPrediction
  , Eb = t.PatchTSMixerModel
  , Fb = t.PatchTSMixerPreTrainedModel
  , kb = t.PatchTSTForPrediction
  , Cb = t.PatchTSTModel
  , Sb = t.PatchTSTPreTrainedModel
  , Lb = t.Phi3ForCausalLM
  , Ab = t.Phi3Model
  , yb = t.Phi3PreTrainedModel
  , Db = t.Phi3VForCausalLM
  , Ib = t.Phi3VImageProcessor
  , Ob = t.Phi3VPreTrainedModel
  , Bb = t.Phi3VProcessor
  , jb = t.PhiForCausalLM
  , Nb = t.PhiModel
  , Vb = t.PhiPreTrainedModel
  , Rb = t.Pipeline
  , zb = t.PreTrainedModel
  , Gb = t.PreTrainedTokenizer
  , Wb = t.PretrainedConfig
  , Ub = t.PretrainedMixin
  , Kb = t.Processor
  , $b = t.PvtForImageClassification
  , Qb = t.PvtImageProcessor
  , Xb = t.PvtModel
  , Hb = t.PvtPreTrainedModel
  , Jb = t.PyAnnoteFeatureExtractor
  , Yb = t.PyAnnoteForAudioFrameClassification
  , qb = t.PyAnnoteModel
  , Zb = t.PyAnnotePreTrainedModel
  , ex = t.PyAnnoteProcessor
  , tx = t.QuestionAnsweringModelOutput
  , sx = t.QuestionAnsweringPipeline
  , rx = t.Qwen2ForCausalLM
  , ox = t.Qwen2Model
  , ax = t.Qwen2PreTrainedModel
  , nx = t.Qwen2Tokenizer
  , ix = t.Qwen2VLForConditionalGeneration
  , lx = t.Qwen2VLImageProcessor
  , cx = t.Qwen2VLPreTrainedModel
  , _x = t.Qwen2VLProcessor
  , dx = t.Qwen3ForCausalLM
  , ux = t.Qwen3Model
  , px = t.Qwen3PreTrainedModel
  , mx = t.RFDetrForObjectDetection
  , Mx = t.RFDetrModel
  , hx = t.RFDetrObjectDetectionOutput
  , fx = t.RFDetrPreTrainedModel
  , gx = t.RTDetrForObjectDetection
  , Px = t.RTDetrImageProcessor
  , Tx = t.RTDetrModel
  , wx = t.RTDetrObjectDetectionOutput
  , bx = t.RTDetrPreTrainedModel
  , xx = t.RTDetrV2ForObjectDetection
  , vx = t.RTDetrV2Model
  , Ex = t.RTDetrV2ObjectDetectionOutput
  , Fx = t.RTDetrV2PreTrainedModel
  , kx = t.RawAudio
  , Cx = t.RawImage
  , Sx = t.RawVideo
  , Lx = t.RawVideoFrame
  , Ax = t.RepetitionPenaltyLogitsProcessor
  , yx = t.ResNetForImageClassification
  , Dx = t.ResNetModel
  , Ix = t.ResNetPreTrainedModel
  , Ox = t.RoFormerForMaskedLM
  , Bx = t.RoFormerForQuestionAnswering
  , jx = t.RoFormerForSequenceClassification
  , Nx = t.RoFormerForTokenClassification
  , Vx = t.RoFormerModel
  , Rx = t.RoFormerPreTrainedModel
  , zx = t.RoFormerTokenizer
  , Gx = t.RobertaForMaskedLM
  , Wx = t.RobertaForQuestionAnswering
  , Ux = t.RobertaForSequenceClassification
  , Kx = t.RobertaForTokenClassification
  , $x = t.RobertaModel
  , Qx = t.RobertaPreTrainedModel
  , Xx = t.RobertaTokenizer
  , Hx = t.Sam2ImageProcessor
  , Jx = t.Sam2ImageSegmentationOutput
  , Yx = t.Sam2Model
  , qx = t.Sam2PreTrainedModel
  , Zx = t.Sam2Processor
  , ev = t.Sam2VideoProcessor
  , tv = t.Sam3ImageProcessor
  , sv = t.Sam3TrackerModel
  , rv = t.SamImageProcessor
  , ov = t.SamImageSegmentationOutput
  , av = t.SamModel
  , nv = t.SamPreTrainedModel
  , iv = t.SamProcessor
  , lv = t.SapiensForDepthEstimation
  , cv = t.SapiensForNormalEstimation
  , _v = t.SapiensForSemanticSegmentation
  , dv = t.SapiensPreTrainedModel
  , uv = t.SeamlessM4TFeatureExtractor
  , pv = t.SegformerFeatureExtractor
  , mv = t.SegformerForImageClassification
  , Mv = t.SegformerForSemanticSegmentation
  , hv = t.SegformerImageProcessor
  , fv = t.SegformerModel
  , gv = t.SegformerPreTrainedModel
  , Pv = t.Seq2SeqLMOutput
  , Tv = t.SequenceClassifierOutput
  , wv = t.SiglipImageProcessor
  , bv = t.SiglipModel
  , xv = t.SiglipPreTrainedModel
  , vv = t.SiglipTextModel
  , Ev = t.SiglipTokenizer
  , Fv = t.SiglipVisionModel
  , kv = t.SmolLM3ForCausalLM
  , Cv = t.SmolLM3Model
  , Sv = t.SmolLM3PreTrainedModel
  , Lv = t.SmolVLMForConditionalGeneration
  , Av = t.SmolVLMImageProcessor
  , yv = t.SmolVLMProcessor
  , Dv = t.SnacDecoderModel
  , Iv = t.SnacEncoderModel
  , Ov = t.SnacFeatureExtractor
  , Bv = t.SnacModel
  , jv = t.SnacPreTrainedModel
  , Nv = t.SpeechT5FeatureExtractor
  , Vv = t.SpeechT5ForSpeechToText
  , Rv = t.SpeechT5ForTextToSpeech
  , zv = t.SpeechT5HifiGan
  , Gv = t.SpeechT5Model
  , Wv = t.SpeechT5PreTrainedModel
  , Uv = t.SpeechT5Processor
  , Kv = t.SpeechT5Tokenizer
  , $v = t.SqueezeBertForMaskedLM
  , Qv = t.SqueezeBertForQuestionAnswering
  , Xv = t.SqueezeBertForSequenceClassification
  , Hv = t.SqueezeBertModel
  , Jv = t.SqueezeBertPreTrainedModel
  , Yv = t.SqueezeBertTokenizer
  , qv = t.StableLmForCausalLM
  , Zv = t.StableLmModel
  , eE = t.StableLmPreTrainedModel
  , tE = t.Starcoder2ForCausalLM
  , sE = t.Starcoder2Model
  , rE = t.Starcoder2PreTrainedModel
  , oE = t.StoppingCriteria
  , aE = t.StoppingCriteriaList
  , nE = t.StyleTextToSpeech2Model
  , iE = t.StyleTextToSpeech2PreTrainedModel
  , lE = t.SummarizationPipeline
  , cE = t.SupertonicForConditionalGeneration
  , _E = t.SupertonicPreTrainedModel
  , dE = t.SuppressTokensAtBeginLogitsProcessor
  , uE = t.Swin2SRForImageSuperResolution
  , pE = t.Swin2SRImageProcessor
  , mE = t.Swin2SRModel
  , ME = t.Swin2SRPreTrainedModel
  , hE = t.SwinForImageClassification
  , fE = t.SwinForSemanticSegmentation
  , gE = t.SwinModel
  , PE = t.SwinPreTrainedModel
  , TE = t.T5ForConditionalGeneration
  , wE = t.T5Model
  , bE = t.T5PreTrainedModel
  , xE = t.T5Tokenizer
  , vE = t.TableTransformerForObjectDetection
  , EE = t.TableTransformerModel
  , FE = t.TableTransformerObjectDetectionOutput
  , kE = t.TableTransformerPreTrainedModel
  , CE = t.TemperatureLogitsWarper
  , SE = t.Tensor
  , LE = t.Text2TextGenerationPipeline
  , AE = t.TextClassificationPipeline
  , yE = t.TextGenerationPipeline
  , DE = t.TextStreamer
  , IE = t.TextToAudioPipeline
  , OE = t.TokenClassificationPipeline
  , BE = t.TokenClassifierOutput
  , jE = t.TokenizerModel
  , NE = t.TopKLogitsWarper
  , VE = t.TopPLogitsWarper
  , RE = t.TrOCRForCausalLM
  , zE = t.TrOCRPreTrainedModel
  , GE = t.TranslationPipeline
  , WE = t.UltravoxModel
  , UE = t.UltravoxPreTrainedModel
  , KE = t.UltravoxProcessor
  , $E = t.UniSpeechForCTC
  , QE = t.UniSpeechForSequenceClassification
  , XE = t.UniSpeechModel
  , HE = t.UniSpeechPreTrainedModel
  , JE = t.UniSpeechSatForAudioFrameClassification
  , YE = t.UniSpeechSatForCTC
  , qE = t.UniSpeechSatForSequenceClassification
  , ZE = t.UniSpeechSatModel
  , eF = t.UniSpeechSatPreTrainedModel
  , tF = t.VLChatProcessor
  , sF = t.VLMImageProcessor
  , rF = t.VaultGemmaForCausalLM
  , oF = t.VaultGemmaModel
  , aF = t.VaultGemmaPreTrainedModel
  , nF = t.ViTFeatureExtractor
  , iF = t.ViTForImageClassification
  , lF = t.ViTImageProcessor
  , cF = t.ViTMAEModel
  , _F = t.ViTMAEPreTrainedModel
  , dF = t.ViTMSNForImageClassification
  , uF = t.ViTMSNModel
  , pF = t.ViTMSNPreTrainedModel
  , mF = t.ViTModel
  , MF = t.ViTPreTrainedModel
  , hF = t.VisionEncoderDecoderModel
  , fF = t.VitMatteForImageMatting
  , gF = t.VitMatteImageProcessor
  , PF = t.VitMattePreTrainedModel
  , TF = t.VitPoseForPoseEstimation
  , wF = t.VitPoseImageProcessor
  , bF = t.VitPosePreTrainedModel
  , xF = t.VitsModel
  , vF = t.VitsModelOutput
  , EF = t.VitsPreTrainedModel
  , FF = t.VitsTokenizer
  , kF = t.VoxtralForConditionalGeneration
  , CF = t.VoxtralProcessor
  , SF = t.Wav2Vec2BertForCTC
  , LF = t.Wav2Vec2BertForSequenceClassification
  , AF = t.Wav2Vec2BertModel
  , yF = t.Wav2Vec2BertPreTrainedModel
  , DF = t.Wav2Vec2CTCTokenizer
  , IF = t.Wav2Vec2FeatureExtractor
  , OF = t.Wav2Vec2ForAudioFrameClassification
  , BF = t.Wav2Vec2ForCTC
  , jF = t.Wav2Vec2ForSequenceClassification
  , NF = t.Wav2Vec2Model
  , VF = t.Wav2Vec2PreTrainedModel
  , RF = t.Wav2Vec2Processor
  , zF = t.Wav2Vec2ProcessorWithLM
  , GF = t.WavLMForAudioFrameClassification
  , WF = t.WavLMForCTC
  , UF = t.WavLMForSequenceClassification
  , KF = t.WavLMForXVector
  , $F = t.WavLMModel
  , QF = t.WavLMPreTrainedModel
  , XF = t.WeSpeakerFeatureExtractor
  , HF = t.WeSpeakerResNetModel
  , JF = t.WeSpeakerResNetPreTrainedModel
  , YF = t.WhisperFeatureExtractor
  , qF = t.WhisperForConditionalGeneration
  , ZF = t.WhisperModel
  , ek = t.WhisperPreTrainedModel
  , tk = t.WhisperProcessor
  , sk = t.WhisperTextStreamer
  , rk = t.WhisperTimeStampLogitsProcessor
  , ok = t.WhisperTokenizer
  , ak = t.XLMForQuestionAnswering
  , nk = t.XLMForSequenceClassification
  , ik = t.XLMForTokenClassification
  , lk = t.XLMModel
  , ck = t.XLMPreTrainedModel
  , _k = t.XLMRobertaForMaskedLM
  , dk = t.XLMRobertaForQuestionAnswering
  , uk = t.XLMRobertaForSequenceClassification
  , pk = t.XLMRobertaForTokenClassification
  , mk = t.XLMRobertaModel
  , Mk = t.XLMRobertaPreTrainedModel
  , hk = t.XLMRobertaTokenizer
  , fk = t.XLMTokenizer
  , gk = t.XLMWithLMHeadModel
  , Pk = t.XVectorOutput
  , Tk = t.YolosFeatureExtractor
  , wk = t.YolosForObjectDetection
  , bk = t.YolosImageProcessor
  , xk = t.YolosModel
  , vk = t.YolosObjectDetectionOutput
  , Ek = t.YolosPreTrainedModel
  , Fk = t.ZeroShotAudioClassificationPipeline
  , kk = t.ZeroShotClassificationPipeline
  , Ck = t.ZeroShotImageClassificationPipeline
  , Sk = t.ZeroShotObjectDetectionPipeline
  , Lk = t.bankers_round
  , Ak = t.cat
  , yk = t.cos_sim
  , Dk = t.dot
  , Ik = t.dynamic_time_warping
  , Ok = t.env
  , Bk = t.full
  , jk = t.full_like
  , Nk = t.getCacheShapes
  , Vk = t.hamming
  , Rk = t.hanning
  , zk = t.interpolate
  , Gk = t.interpolate_4d
  , Wk = t.interpolate_data
  , Uk = t.is_chinese_char
  , Kk = t.layer_norm
  , $k = t.load_image
  , Qk = t.load_video
  , Xk = t.log_softmax
  , Hk = t.magnitude
  , Jk = t.matmul
  , Yk = t.max
  , qk = t.mean
  , Zk = t.mean_pooling
  , eC = t.medianFilter
  , tC = t.mel_filter_bank
  , sC = t.min
  , rC = t.ones
  , oC = t.ones_like
  , aC = t.permute
  , nC = t.permute_data
  , iC = t.pipeline
  , lC = t.quantize_embeddings
  , cC = t.rand
  , _C = t.randn
  , dC = t.read_audio
  , uC = t.rfft
  , pC = t.round
  , mC = t.slice
  , MC = t.softmax
  , hC = t.spectrogram
  , fC = t.stack
  , gC = t.std_mean
  , PC = t.topk
  , TC = t.window_function
  , wC = t.zeros
  , bC = t.zeros_like;
export {Nu as ASTFeatureExtractor, Vu as ASTForAudioClassification, Ru as ASTModel, zu as ASTPreTrainedModel, Gu as AlbertForMaskedLM, Wu as AlbertForQuestionAnswering, Uu as AlbertForSequenceClassification, Ku as AlbertModel, $u as AlbertPreTrainedModel, Qu as AlbertTokenizer, Xu as ArceeForCausalLM, Hu as ArceeModel, Ju as ArceePreTrainedModel, Yu as AudioClassificationPipeline, qu as AutoConfig, Zu as AutoFeatureExtractor, ep as AutoImageProcessor, tp as AutoModel, sp as AutoModelForAudioClassification, rp as AutoModelForAudioFrameClassification, op as AutoModelForAudioTextToText, ap as AutoModelForCTC, np as AutoModelForCausalLM, ip as AutoModelForDepthEstimation, lp as AutoModelForDocumentQuestionAnswering, cp as AutoModelForImageClassification, _p as AutoModelForImageFeatureExtraction, dp as AutoModelForImageMatting, up as AutoModelForImageSegmentation, pp as AutoModelForImageTextToText, mp as AutoModelForImageToImage, Mp as AutoModelForMaskGeneration, hp as AutoModelForMaskedLM, fp as AutoModelForNormalEstimation, gp as AutoModelForObjectDetection, Pp as AutoModelForPoseEstimation, Tp as AutoModelForQuestionAnswering, wp as AutoModelForSemanticSegmentation, bp as AutoModelForSeq2SeqLM, xp as AutoModelForSequenceClassification, vp as AutoModelForSpeechSeq2Seq, Ep as AutoModelForTextToSpectrogram, Fp as AutoModelForTextToWaveform, kp as AutoModelForTokenClassification, Cp as AutoModelForUniversalSegmentation, Sp as AutoModelForVision2Seq, Lp as AutoModelForXVector, Ap as AutoModelForZeroShotObjectDetection, yp as AutoProcessor, Dp as AutoTokenizer, Ip as AutomaticSpeechRecognitionPipeline, Op as BackgroundRemovalPipeline, Bp as BartForConditionalGeneration, jp as BartForSequenceClassification, Np as BartModel, Vp as BartPretrainedModel, Rp as BartTokenizer, zp as BaseModelOutput, Gp as BaseStreamer, Wp as BeitFeatureExtractor, Up as BeitForImageClassification, Kp as BeitModel, $p as BeitPreTrainedModel, Qp as BertForMaskedLM, Xp as BertForQuestionAnswering, Hp as BertForSequenceClassification, Jp as BertForTokenClassification, Yp as BertModel, qp as BertPreTrainedModel, Zp as BertTokenizer, em as BitImageProcessor, tm as BlenderbotForConditionalGeneration, sm as BlenderbotModel, rm as BlenderbotPreTrainedModel, om as BlenderbotSmallForConditionalGeneration, am as BlenderbotSmallModel, nm as BlenderbotSmallPreTrainedModel, im as BlenderbotSmallTokenizer, lm as BlenderbotTokenizer, cm as BloomForCausalLM, _m as BloomModel, dm as BloomPreTrainedModel, um as BloomTokenizer, pm as CLIPFeatureExtractor, mm as CLIPImageProcessor, Mm as CLIPModel, hm as CLIPPreTrainedModel, fm as CLIPSegForImageSegmentation, gm as CLIPSegModel, Pm as CLIPSegPreTrainedModel, Tm as CLIPTextModel, wm as CLIPTextModelWithProjection, bm as CLIPTokenizer, xm as CLIPVisionModel, vm as CLIPVisionModelWithProjection, Em as CamembertForMaskedLM, Fm as CamembertForQuestionAnswering, km as CamembertForSequenceClassification, Cm as CamembertForTokenClassification, Sm as CamembertModel, Lm as CamembertPreTrainedModel, Am as CamembertTokenizer, ym as CausalLMOutput, Dm as CausalLMOutputWithPast, Im as ChineseCLIPFeatureExtractor, Om as ChineseCLIPModel, Bm as ChineseCLIPPreTrainedModel, jm as ClapAudioModelWithProjection, Nm as ClapFeatureExtractor, Vm as ClapModel, Rm as ClapPreTrainedModel, zm as ClapTextModelWithProjection, Gm as ClassifierFreeGuidanceLogitsProcessor, Wm as CodeGenForCausalLM, Um as CodeGenModel, Km as CodeGenPreTrainedModel, $m as CodeGenTokenizer, Qm as CodeLlamaTokenizer, Xm as CohereForCausalLM, Hm as CohereModel, Jm as CoherePreTrainedModel, Ym as CohereTokenizer, qm as ConvBertForMaskedLM, Zm as ConvBertForQuestionAnswering, eM as ConvBertForSequenceClassification, tM as ConvBertForTokenClassification, sM as ConvBertModel, rM as ConvBertPreTrainedModel, oM as ConvBertTokenizer, aM as ConvNextFeatureExtractor, nM as ConvNextForImageClassification, iM as ConvNextImageProcessor, lM as ConvNextModel, cM as ConvNextPreTrainedModel, _M as ConvNextV2ForImageClassification, dM as ConvNextV2Model, uM as ConvNextV2PreTrainedModel, pM as DFineForObjectDetection, mM as DFineModel, MM as DFinePreTrainedModel, hM as DINOv3ConvNextModel, fM as DINOv3ConvNextPreTrainedModel, gM as DINOv3ViTImageProcessor, PM as DINOv3ViTModel, TM as DINOv3ViTPreTrainedModel, wM as DPTFeatureExtractor, bM as DPTForDepthEstimation, xM as DPTImageProcessor, vM as DPTModel, EM as DPTPreTrainedModel, FM as DacDecoderModel, kM as DacDecoderOutput, CM as DacEncoderModel, SM as DacEncoderOutput, LM as DacFeatureExtractor, AM as DacModel, yM as DacPreTrainedModel, DM as DataTypeMap, IM as DebertaForMaskedLM, OM as DebertaForQuestionAnswering, BM as DebertaForSequenceClassification, jM as DebertaForTokenClassification, NM as DebertaModel, VM as DebertaPreTrainedModel, RM as DebertaTokenizer, zM as DebertaV2ForMaskedLM, GM as DebertaV2ForQuestionAnswering, WM as DebertaV2ForSequenceClassification, UM as DebertaV2ForTokenClassification, KM as DebertaV2Model, $M as DebertaV2PreTrainedModel, QM as DebertaV2Tokenizer, XM as DecisionTransformerModel, HM as DecisionTransformerPreTrainedModel, JM as DeiTFeatureExtractor, YM as DeiTForImageClassification, qM as DeiTImageProcessor, ZM as DeiTModel, eh as DeiTPreTrainedModel, th as DepthAnythingForDepthEstimation, sh as DepthAnythingPreTrainedModel, rh as DepthEstimationPipeline, oh as DepthProForDepthEstimation, ah as DepthProPreTrainedModel, nh as DetrFeatureExtractor, ih as DetrForObjectDetection, lh as DetrForSegmentation, ch as DetrImageProcessor, _h as DetrModel, dh as DetrObjectDetectionOutput, uh as DetrPreTrainedModel, ph as DetrSegmentationOutput, mh as Dinov2ForImageClassification, Mh as Dinov2Model, hh as Dinov2PreTrainedModel, fh as Dinov2WithRegistersForImageClassification, gh as Dinov2WithRegistersModel, Ph as Dinov2WithRegistersPreTrainedModel, Th as DistilBertForMaskedLM, wh as DistilBertForQuestionAnswering, bh as DistilBertForSequenceClassification, xh as DistilBertForTokenClassification, vh as DistilBertModel, Eh as DistilBertPreTrainedModel, Fh as DistilBertTokenizer, kh as DocumentQuestionAnsweringPipeline, Ch as DonutFeatureExtractor, Sh as DonutImageProcessor, Lh as DonutSwinModel, Ah as DonutSwinPreTrainedModel, yh as EdgeTamModel, Dh as EfficientNetForImageClassification, Ih as EfficientNetImageProcessor, Oh as EfficientNetModel, Bh as EfficientNetPreTrainedModel, jh as ElectraForMaskedLM, Nh as ElectraForQuestionAnswering, Vh as ElectraForSequenceClassification, Rh as ElectraForTokenClassification, zh as ElectraModel, Gh as ElectraPreTrainedModel, Wh as ElectraTokenizer, Uh as EncodecFeatureExtractor, Kh as EosTokenCriteria, $h as Ernie4_5_ForCausalLM, Qh as Ernie4_5_Model, Xh as Ernie4_5_PretrainedModel, Hh as Ernie4_5_Tokenizer, Jh as EsmForMaskedLM, Yh as EsmForSequenceClassification, qh as EsmForTokenClassification, Zh as EsmModel, ef as EsmPreTrainedModel, tf as EsmTokenizer, sf as ExaoneForCausalLM, rf as ExaoneModel, of as ExaonePreTrainedModel, af as FFT, nf as FalconForCausalLM, lf as FalconModel, cf as FalconPreTrainedModel, _f as FalconTokenizer, df as FastViTForImageClassification, uf as FastViTModel, pf as FastViTPreTrainedModel, mf as FeatureExtractionPipeline, Mf as FeatureExtractor, hf as FillMaskPipeline, ff as Florence2ForConditionalGeneration, gf as Florence2PreTrainedModel, Pf as Florence2Processor, Tf as ForcedBOSTokenLogitsProcessor, wf as ForcedEOSTokenLogitsProcessor, bf as GLPNFeatureExtractor, xf as GLPNForDepthEstimation, vf as GLPNModel, Ef as GLPNPreTrainedModel, Ff as GPT2LMHeadModel, kf as GPT2Model, Cf as GPT2PreTrainedModel, Sf as GPT2Tokenizer, Lf as GPTBigCodeForCausalLM, Af as GPTBigCodeModel, yf as GPTBigCodePreTrainedModel, Df as GPTJForCausalLM, If as GPTJModel, Of as GPTJPreTrainedModel, Bf as GPTNeoForCausalLM, jf as GPTNeoModel, Nf as GPTNeoPreTrainedModel, Vf as GPTNeoXForCausalLM, Rf as GPTNeoXModel, zf as GPTNeoXPreTrainedModel, Gf as GPTNeoXTokenizer, Wf as Gemma2ForCausalLM, Uf as Gemma2Model, Kf as Gemma2PreTrainedModel, $f as Gemma3ForCausalLM, Qf as Gemma3Model, Xf as Gemma3PreTrainedModel, Hf as Gemma3nAudioFeatureExtractor, Jf as Gemma3nForConditionalGeneration, Yf as Gemma3nPreTrainedModel, qf as Gemma3nProcessor, Zf as GemmaForCausalLM, eg as GemmaModel, tg as GemmaPreTrainedModel, sg as GemmaTokenizer, rg as GlmForCausalLM, og as GlmModel, ag as GlmPreTrainedModel, ng as GraniteForCausalLM, ig as GraniteModel, lg as GraniteMoeHybridForCausalLM, cg as GraniteMoeHybridModel, _g as GraniteMoeHybridPreTrainedModel, dg as GranitePreTrainedModel, ug as Grok1Tokenizer, pg as GroundingDinoForObjectDetection, mg as GroundingDinoImageProcessor, Mg as GroundingDinoPreTrainedModel, hg as GroundingDinoProcessor, fg as GroupViTModel, gg as GroupViTPreTrainedModel, Pg as HeliumForCausalLM, Tg as HeliumModel, wg as HeliumPreTrainedModel, bg as HerbertTokenizer, xg as HieraForImageClassification, vg as HieraModel, Eg as HieraPreTrainedModel, Fg as HubertForCTC, kg as HubertForSequenceClassification, Cg as HubertModel, Sg as HubertPreTrainedModel, Lg as IJepaForImageClassification, Ag as IJepaModel, yg as IJepaPreTrainedModel, Dg as Idefics3ForConditionalGeneration, Ig as Idefics3ImageProcessor, Og as Idefics3PreTrainedModel, Bg as Idefics3Processor, jg as ImageClassificationPipeline, Ng as ImageFeatureExtractionPipeline, Vg as ImageFeatureExtractor, Rg as ImageMattingOutput, zg as ImageProcessor, Gg as ImageSegmentationPipeline, Wg as ImageToImagePipeline, Ug as ImageToTextPipeline, Kg as InterruptableStoppingCriteria, $g as JAISLMHeadModel, Qg as JAISModel, Xg as JAISPreTrainedModel, Hg as JinaCLIPImageProcessor, Jg as JinaCLIPModel, Yg as JinaCLIPPreTrainedModel, qg as JinaCLIPProcessor, Zg as JinaCLIPTextModel, eP as JinaCLIPVisionModel, tP as Lfm2ForCausalLM, sP as Lfm2Model, rP as Lfm2PreTrainedModel, oP as LiteWhisperForConditionalGeneration, aP as Llama4ForCausalLM, nP as Llama4PreTrainedModel, iP as LlamaForCausalLM, lP as LlamaModel, cP as LlamaPreTrainedModel, _P as LlamaTokenizer, dP as LlavaForConditionalGeneration, uP as LlavaOnevisionForConditionalGeneration, pP as LlavaOnevisionImageProcessor, mP as LlavaPreTrainedModel, MP as LlavaProcessor, hP as LlavaQwen2ForCausalLM, fP as LogitsProcessor, gP as LogitsProcessorList, PP as LogitsWarper, TP as LongT5ForConditionalGeneration, wP as LongT5Model, bP as LongT5PreTrainedModel, xP as M2M100ForConditionalGeneration, vP as M2M100Model, EP as M2M100PreTrainedModel, FP as M2M100Tokenizer, kP as MBart50Tokenizer, CP as MBartForCausalLM, SP as MBartForConditionalGeneration, LP as MBartForSequenceClassification, AP as MBartModel, yP as MBartPreTrainedModel, DP as MBartTokenizer, IP as MPNetForMaskedLM, OP as MPNetForQuestionAnswering, BP as MPNetForSequenceClassification, jP as MPNetForTokenClassification, NP as MPNetModel, VP as MPNetPreTrainedModel, RP as MPNetTokenizer, zP as MT5ForConditionalGeneration, GP as MT5Model, WP as MT5PreTrainedModel, UP as MarianMTModel, KP as MarianModel, $P as MarianPreTrainedModel, QP as MarianTokenizer, XP as Mask2FormerImageProcessor, HP as MaskFormerFeatureExtractor, JP as MaskFormerForInstanceSegmentation, YP as MaskFormerImageProcessor, qP as MaskFormerModel, ZP as MaskFormerPreTrainedModel, eT as MaskedLMOutput, tT as MaxLengthCriteria, sT as Metric3DForDepthEstimation, rT as Metric3DPreTrainedModel, oT as Metric3Dv2ForDepthEstimation, aT as Metric3Dv2PreTrainedModel, nT as MgpstrForSceneTextRecognition, iT as MgpstrModelOutput, lT as MgpstrPreTrainedModel, cT as MgpstrProcessor, _T as MgpstrTokenizer, dT as MimiDecoderModel, uT as MimiDecoderOutput, pT as MimiEncoderModel, mT as MimiEncoderOutput, MT as MimiModel, hT as MimiPreTrainedModel, fT as MinLengthLogitsProcessor, gT as MinNewTokensLengthLogitsProcessor, PT as MistralForCausalLM, TT as MistralModel, wT as MistralPreTrainedModel, bT as MobileBertForMaskedLM, xT as MobileBertForQuestionAnswering, vT as MobileBertForSequenceClassification, ET as MobileBertModel, FT as MobileBertPreTrainedModel, kT as MobileBertTokenizer, CT as MobileLLMForCausalLM, ST as MobileLLMModel, LT as MobileLLMPreTrainedModel, AT as MobileNetV1FeatureExtractor, yT as MobileNetV1ForImageClassification, DT as MobileNetV1ForSemanticSegmentation, IT as MobileNetV1ImageProcessor, OT as MobileNetV1Model, BT as MobileNetV1PreTrainedModel, jT as MobileNetV2FeatureExtractor, NT as MobileNetV2ForImageClassification, VT as MobileNetV2ForSemanticSegmentation, RT as MobileNetV2ImageProcessor, zT as MobileNetV2Model, GT as MobileNetV2PreTrainedModel, WT as MobileNetV3FeatureExtractor, UT as MobileNetV3ForImageClassification, KT as MobileNetV3ForSemanticSegmentation, $T as MobileNetV3ImageProcessor, QT as MobileNetV3Model, XT as MobileNetV3PreTrainedModel, HT as MobileNetV4FeatureExtractor, JT as MobileNetV4ForImageClassification, YT as MobileNetV4ForSemanticSegmentation, qT as MobileNetV4ImageProcessor, ZT as MobileNetV4Model, ew as MobileNetV4PreTrainedModel, tw as MobileViTFeatureExtractor, sw as MobileViTForImageClassification, rw as MobileViTImageProcessor, ow as MobileViTModel, aw as MobileViTPreTrainedModel, nw as MobileViTV2ForImageClassification, iw as MobileViTV2Model, lw as MobileViTV2PreTrainedModel, cw as ModelOutput, _w as ModernBertDecoderForCausalLM, dw as ModernBertDecoderModel, uw as ModernBertDecoderPreTrainedModel, pw as ModernBertForMaskedLM, mw as ModernBertForSequenceClassification, Mw as ModernBertForTokenClassification, hw as ModernBertModel, fw as ModernBertPreTrainedModel, gw as Moondream1ForConditionalGeneration, Pw as MoonshineFeatureExtractor, Tw as MoonshineForConditionalGeneration, ww as MoonshineModel, bw as MoonshinePreTrainedModel, xw as MoonshineProcessor, vw as MptForCausalLM, Ew as MptModel, Fw as MptPreTrainedModel, kw as MultiModalityCausalLM, Cw as MultiModalityPreTrainedModel, Sw as MusicgenForCausalLM, Lw as MusicgenForConditionalGeneration, Aw as MusicgenModel, yw as MusicgenPreTrainedModel, Dw as NanoChatForCausalLM, Iw as NanoChatModel, Ow as NanoChatPreTrainedModel, Bw as NeoBertForMaskedLM, jw as NeoBertForQuestionAnswering, Nw as NeoBertForSequenceClassification, Vw as NeoBertForTokenClassification, Rw as NeoBertModel, zw as NeoBertPreTrainedModel, Gw as NllbTokenizer, Ww as NoBadWordsLogitsProcessor, Uw as NoRepeatNGramLogitsProcessor, Kw as NomicBertModel, $w as NomicBertPreTrainedModel, Qw as NougatImageProcessor, Xw as NougatTokenizer, Hw as OPTForCausalLM, Jw as OPTModel, Yw as OPTPreTrainedModel, qw as ObjectDetectionPipeline, Zw as Olmo2ForCausalLM, eb as Olmo2Model, tb as Olmo2PreTrainedModel, sb as OlmoForCausalLM, rb as OlmoModel, ob as OlmoPreTrainedModel, ab as OpenELMForCausalLM, nb as OpenELMModel, ib as OpenELMPreTrainedModel, lb as OwlViTFeatureExtractor, cb as OwlViTForObjectDetection, _b as OwlViTImageProcessor, db as OwlViTModel, ub as OwlViTPreTrainedModel, pb as OwlViTProcessor, mb as Owlv2ForObjectDetection, Mb as Owlv2ImageProcessor, hb as Owlv2Model, fb as Owlv2PreTrainedModel, gb as PaliGemmaForConditionalGeneration, Pb as PaliGemmaPreTrainedModel, Tb as PaliGemmaProcessor, wb as ParakeetFeatureExtractor, bb as ParakeetForCTC, xb as ParakeetPreTrainedModel, vb as PatchTSMixerForPrediction, Eb as PatchTSMixerModel, Fb as PatchTSMixerPreTrainedModel, kb as PatchTSTForPrediction, Cb as PatchTSTModel, Sb as PatchTSTPreTrainedModel, Lb as Phi3ForCausalLM, Ab as Phi3Model, yb as Phi3PreTrainedModel, Db as Phi3VForCausalLM, Ib as Phi3VImageProcessor, Ob as Phi3VPreTrainedModel, Bb as Phi3VProcessor, jb as PhiForCausalLM, Nb as PhiModel, Vb as PhiPreTrainedModel, Rb as Pipeline, zb as PreTrainedModel, Gb as PreTrainedTokenizer, Wb as PretrainedConfig, Ub as PretrainedMixin, Kb as Processor, $b as PvtForImageClassification, Qb as PvtImageProcessor, Xb as PvtModel, Hb as PvtPreTrainedModel, Jb as PyAnnoteFeatureExtractor, Yb as PyAnnoteForAudioFrameClassification, qb as PyAnnoteModel, Zb as PyAnnotePreTrainedModel, ex as PyAnnoteProcessor, tx as QuestionAnsweringModelOutput, sx as QuestionAnsweringPipeline, rx as Qwen2ForCausalLM, ox as Qwen2Model, ax as Qwen2PreTrainedModel, nx as Qwen2Tokenizer, ix as Qwen2VLForConditionalGeneration, lx as Qwen2VLImageProcessor, cx as Qwen2VLPreTrainedModel, _x as Qwen2VLProcessor, dx as Qwen3ForCausalLM, ux as Qwen3Model, px as Qwen3PreTrainedModel, mx as RFDetrForObjectDetection, Mx as RFDetrModel, hx as RFDetrObjectDetectionOutput, fx as RFDetrPreTrainedModel, gx as RTDetrForObjectDetection, Px as RTDetrImageProcessor, Tx as RTDetrModel, wx as RTDetrObjectDetectionOutput, bx as RTDetrPreTrainedModel, xx as RTDetrV2ForObjectDetection, vx as RTDetrV2Model, Ex as RTDetrV2ObjectDetectionOutput, Fx as RTDetrV2PreTrainedModel, kx as RawAudio, Cx as RawImage, Sx as RawVideo, Lx as RawVideoFrame, Ax as RepetitionPenaltyLogitsProcessor, yx as ResNetForImageClassification, Dx as ResNetModel, Ix as ResNetPreTrainedModel, Ox as RoFormerForMaskedLM, Bx as RoFormerForQuestionAnswering, jx as RoFormerForSequenceClassification, Nx as RoFormerForTokenClassification, Vx as RoFormerModel, Rx as RoFormerPreTrainedModel, zx as RoFormerTokenizer, Gx as RobertaForMaskedLM, Wx as RobertaForQuestionAnswering, Ux as RobertaForSequenceClassification, Kx as RobertaForTokenClassification, $x as RobertaModel, Qx as RobertaPreTrainedModel, Xx as RobertaTokenizer, Hx as Sam2ImageProcessor, Jx as Sam2ImageSegmentationOutput, Yx as Sam2Model, qx as Sam2PreTrainedModel, Zx as Sam2Processor, ev as Sam2VideoProcessor, tv as Sam3ImageProcessor, sv as Sam3TrackerModel, rv as SamImageProcessor, ov as SamImageSegmentationOutput, av as SamModel, nv as SamPreTrainedModel, iv as SamProcessor, lv as SapiensForDepthEstimation, cv as SapiensForNormalEstimation, _v as SapiensForSemanticSegmentation, dv as SapiensPreTrainedModel, uv as SeamlessM4TFeatureExtractor, pv as SegformerFeatureExtractor, mv as SegformerForImageClassification, Mv as SegformerForSemanticSegmentation, hv as SegformerImageProcessor, fv as SegformerModel, gv as SegformerPreTrainedModel, Pv as Seq2SeqLMOutput, Tv as SequenceClassifierOutput, wv as SiglipImageProcessor, bv as SiglipModel, xv as SiglipPreTrainedModel, vv as SiglipTextModel, Ev as SiglipTokenizer, Fv as SiglipVisionModel, kv as SmolLM3ForCausalLM, Cv as SmolLM3Model, Sv as SmolLM3PreTrainedModel, Lv as SmolVLMForConditionalGeneration, Av as SmolVLMImageProcessor, yv as SmolVLMProcessor, Dv as SnacDecoderModel, Iv as SnacEncoderModel, Ov as SnacFeatureExtractor, Bv as SnacModel, jv as SnacPreTrainedModel, Nv as SpeechT5FeatureExtractor, Vv as SpeechT5ForSpeechToText, Rv as SpeechT5ForTextToSpeech, zv as SpeechT5HifiGan, Gv as SpeechT5Model, Wv as SpeechT5PreTrainedModel, Uv as SpeechT5Processor, Kv as SpeechT5Tokenizer, $v as SqueezeBertForMaskedLM, Qv as SqueezeBertForQuestionAnswering, Xv as SqueezeBertForSequenceClassification, Hv as SqueezeBertModel, Jv as SqueezeBertPreTrainedModel, Yv as SqueezeBertTokenizer, qv as StableLmForCausalLM, Zv as StableLmModel, eE as StableLmPreTrainedModel, tE as Starcoder2ForCausalLM, sE as Starcoder2Model, rE as Starcoder2PreTrainedModel, oE as StoppingCriteria, aE as StoppingCriteriaList, nE as StyleTextToSpeech2Model, iE as StyleTextToSpeech2PreTrainedModel, lE as SummarizationPipeline, cE as SupertonicForConditionalGeneration, _E as SupertonicPreTrainedModel, dE as SuppressTokensAtBeginLogitsProcessor, uE as Swin2SRForImageSuperResolution, pE as Swin2SRImageProcessor, mE as Swin2SRModel, ME as Swin2SRPreTrainedModel, hE as SwinForImageClassification, fE as SwinForSemanticSegmentation, gE as SwinModel, PE as SwinPreTrainedModel, TE as T5ForConditionalGeneration, wE as T5Model, bE as T5PreTrainedModel, xE as T5Tokenizer, vE as TableTransformerForObjectDetection, EE as TableTransformerModel, FE as TableTransformerObjectDetectionOutput, kE as TableTransformerPreTrainedModel, CE as TemperatureLogitsWarper, SE as Tensor, LE as Text2TextGenerationPipeline, AE as TextClassificationPipeline, yE as TextGenerationPipeline, DE as TextStreamer, IE as TextToAudioPipeline, OE as TokenClassificationPipeline, BE as TokenClassifierOutput, jE as TokenizerModel, NE as TopKLogitsWarper, VE as TopPLogitsWarper, RE as TrOCRForCausalLM, zE as TrOCRPreTrainedModel, GE as TranslationPipeline, WE as UltravoxModel, UE as UltravoxPreTrainedModel, KE as UltravoxProcessor, $E as UniSpeechForCTC, QE as UniSpeechForSequenceClassification, XE as UniSpeechModel, HE as UniSpeechPreTrainedModel, JE as UniSpeechSatForAudioFrameClassification, YE as UniSpeechSatForCTC, qE as UniSpeechSatForSequenceClassification, ZE as UniSpeechSatModel, eF as UniSpeechSatPreTrainedModel, tF as VLChatProcessor, sF as VLMImageProcessor, rF as VaultGemmaForCausalLM, oF as VaultGemmaModel, aF as VaultGemmaPreTrainedModel, nF as ViTFeatureExtractor, iF as ViTForImageClassification, lF as ViTImageProcessor, cF as ViTMAEModel, _F as ViTMAEPreTrainedModel, dF as ViTMSNForImageClassification, uF as ViTMSNModel, pF as ViTMSNPreTrainedModel, mF as ViTModel, MF as ViTPreTrainedModel, hF as VisionEncoderDecoderModel, fF as VitMatteForImageMatting, gF as VitMatteImageProcessor, PF as VitMattePreTrainedModel, TF as VitPoseForPoseEstimation, wF as VitPoseImageProcessor, bF as VitPosePreTrainedModel, xF as VitsModel, vF as VitsModelOutput, EF as VitsPreTrainedModel, FF as VitsTokenizer, kF as VoxtralForConditionalGeneration, CF as VoxtralProcessor, SF as Wav2Vec2BertForCTC, LF as Wav2Vec2BertForSequenceClassification, AF as Wav2Vec2BertModel, yF as Wav2Vec2BertPreTrainedModel, DF as Wav2Vec2CTCTokenizer, IF as Wav2Vec2FeatureExtractor, OF as Wav2Vec2ForAudioFrameClassification, BF as Wav2Vec2ForCTC, jF as Wav2Vec2ForSequenceClassification, NF as Wav2Vec2Model, VF as Wav2Vec2PreTrainedModel, RF as Wav2Vec2Processor, zF as Wav2Vec2ProcessorWithLM, GF as WavLMForAudioFrameClassification, WF as WavLMForCTC, UF as WavLMForSequenceClassification, KF as WavLMForXVector, $F as WavLMModel, QF as WavLMPreTrainedModel, XF as WeSpeakerFeatureExtractor, HF as WeSpeakerResNetModel, JF as WeSpeakerResNetPreTrainedModel, YF as WhisperFeatureExtractor, qF as WhisperForConditionalGeneration, ZF as WhisperModel, ek as WhisperPreTrainedModel, tk as WhisperProcessor, sk as WhisperTextStreamer, rk as WhisperTimeStampLogitsProcessor, ok as WhisperTokenizer, ak as XLMForQuestionAnswering, nk as XLMForSequenceClassification, ik as XLMForTokenClassification, lk as XLMModel, ck as XLMPreTrainedModel, _k as XLMRobertaForMaskedLM, dk as XLMRobertaForQuestionAnswering, uk as XLMRobertaForSequenceClassification, pk as XLMRobertaForTokenClassification, mk as XLMRobertaModel, Mk as XLMRobertaPreTrainedModel, hk as XLMRobertaTokenizer, fk as XLMTokenizer, gk as XLMWithLMHeadModel, Pk as XVectorOutput, Tk as YolosFeatureExtractor, wk as YolosForObjectDetection, bk as YolosImageProcessor, xk as YolosModel, vk as YolosObjectDetectionOutput, Ek as YolosPreTrainedModel, Fk as ZeroShotAudioClassificationPipeline, kk as ZeroShotClassificationPipeline, Ck as ZeroShotImageClassificationPipeline, Sk as ZeroShotObjectDetectionPipeline, Lk as bankers_round, Ak as cat, yk as cos_sim, Dk as dot, Ik as dynamic_time_warping, Ok as env, Bk as full, jk as full_like, Nk as getCacheShapes, Vk as hamming, Rk as hanning, zk as interpolate, Gk as interpolate_4d, Wk as interpolate_data, Uk as is_chinese_char, Kk as layer_norm, $k as load_image, Qk as load_video, Xk as log_softmax, Hk as magnitude, Jk as matmul, Yk as max, qk as mean, Zk as mean_pooling, eC as medianFilter, tC as mel_filter_bank, sC as min, rC as ones, oC as ones_like, aC as permute, nC as permute_data, iC as pipeline, lC as quantize_embeddings, cC as rand, _C as randn, dC as read_audio, uC as rfft, pC as round, mC as slice, MC as softmax, hC as spectrogram, fC as stack, gC as std_mean, PC as topk, TC as window_function, wC as zeros, bC as zeros_like};
/*! Bundled license information:

@huggingface/transformers/dist/transformers.web.js:
  (*!*****************************!*\
    !*** ./src/transformers.js ***!
    \*****************************)
*/
//# sourceMappingURL=transformers.mjs.map
