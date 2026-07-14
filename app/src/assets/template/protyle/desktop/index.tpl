<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
    <title>Protyle</title>
    <link rel="stylesheet" href="./base.css">
</head>
<body>
<main class="protyle-standalone">
    <div id="protyle-root"></div>
</main>
<div id="protyle-status" data-type="loading">Loading document...</div>
<div id="commonMenu" class="b3-menu fn__none">
    <div class="b3-menu__title fn__none">
        <svg class="b3-menu__icon"><use xlink:href="#iconLeft"></use></svg>
        <span class="b3-menu__label"></span>
    </div>
    <div class="b3-menu__items"></div>
</div>
<div id="message" class="b3-snackbars"></div>
<div id="tooltip" class="tooltip fn__none"></div>
<script type="module">
    const root = document.getElementById("protyle-root");
    const status = document.getElementById("protyle-status");
    const blockId = new URLSearchParams(location.search).get("blockId") || undefined;
    const setStatus = (message, type) => {
        status.textContent = message;
        status.dataset.type = type;
    };

    setStatus(blockId ? "Loading document..." : "Loading daily note...", "loading");
    const entryURL = new URL("./protyle.js", import.meta.url);
    entryURL.searchParams.set("v", Date.now().toString());
    import(entryURL.href).then(({mountStandaloneProtyle}) => mountStandaloneProtyle({target: root, blockId})).then(editor => {
        window.standaloneProtyle = editor;
        setStatus("", "ready");
    }).catch(error => {
        console.error("[protyle-standalone] bootstrap failed:", error);
        setStatus(error instanceof Error ? error.message : String(error), "error");
    });
</script>
</body>
</html>
