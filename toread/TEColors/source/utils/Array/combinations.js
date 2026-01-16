export function combinations(array, size) {
    function combine(startIndex, combo) {
        if (combo.length === size) {
            result.push(combo.slice());
            return;
        }
        for (let i = startIndex; i <= array.length - size + combo.length; i++) {
            combo.push(array[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }

    const result = [];
    combine(0, []);
    return result;
}