module.exports = {
    // Line length
    printWidth: 120,

    // Indentation
    tabWidth: 4,
    useTabs: false,

    // Quotes
    singleQuote: true,
    quoteProps: 'as-needed',
    jsxSingleQuote: false,

    // Semicolons
    semi: true,

    // Trailing commas
    trailingComma: 'none',

    // Brackets and spacing
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'avoid',

    // Whitespace
    endOfLine: 'lf',
    embeddedLanguageFormatting: 'auto',

    // Object formatting
    proseWrap: 'preserve',

    // HTML
    htmlWhitespaceSensitivity: 'css',

    // Overrides for specific file types
    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2
            }
        },
        {
            files: '*.md',
            options: {
                tabWidth: 2,
                proseWrap: 'always'
            }
        }
    ]
}; 