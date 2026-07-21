<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>S-Forge Agent</title>
    <link rel="stylesheet" href="./base.css">
</head>
<body>
<main id="agent-panel"></main>
<script type="module">
    const entryURL = new URL("./agent-panel.js", import.meta.url);
    entryURL.searchParams.set("v", Date.now().toString());
    import(entryURL.href);
</script>
</body>
</html>
