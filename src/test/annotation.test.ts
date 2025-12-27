import * as assert from 'assert';

suite('Annotation Logic Suite', () => {

    // 1. Replicate the Regex logic exactly from AnnotationScanner.ts
    // We use the default tags list found in your constructor
    const defaultTags = ['TODO', 'FIXME', 'BUG', 'NOTE', 'HACK', 'OPTIMIZE', 'REVIEW', 'XXX', 'QUESTION', 'ISSUE'];

    // The exact regex construction used in your code:
    // new RegExp(`\\b(${this.tags.join('|')})\\b`, 'i');
    const pattern = new RegExp(`\\b(${defaultTags.join('|')})\\b`, 'i');

    test('Should match standard UPPERCASE tags', () => {
        const line = '// TODO: Refactor this later';
        const match = line.match(pattern);

        assert.ok(match, 'Should find a match');
        assert.strictEqual(match![1].toUpperCase(), 'TODO', 'Should detect TODO tag');
    });

    test('Should match lowercase tags (Case Insensitive)', () => {
        const line = '// fixme: this is broken';
        const match = line.match(pattern);

        assert.ok(match, 'Should find a match');
        assert.strictEqual(match![1].toUpperCase(), 'FIXME', 'Should detect fixme as FIXME');
    });

    test('Should match tags without colons', () => {
        const line = '// HACK this is ugly code';
        const match = line.match(pattern);

        assert.ok(match, 'Should find a match even without a colon');
        assert.strictEqual(match![1].toUpperCase(), 'HACK', 'Should detect HACK tag');
    });

    test('Should ignore tags inside other words (Word Boundary)', () => {
        // "todos" contains "todo", but \b prevents a match
        const line = 'const todos = [];';
        const match = line.match(pattern);

        assert.strictEqual(match, null, 'Should NOT match "todos" because of word boundary');
    });

    test('Should detect BUG tag', () => {
        const line = 'console.log("debug"); // BUG here';
        const match = line.match(pattern);

        assert.ok(match, 'Should find the bug tag');
        assert.strictEqual(match![1].toUpperCase(), 'BUG', 'Should detect BUG tag');
    });
});