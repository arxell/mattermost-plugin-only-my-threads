import {fileURLToPath} from 'node:url';

import {defineConfig} from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL('./src/' + p, import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            // Jest resolved these through moduleDirectories: ["src"]; the
            // webpack build does the same via resolve.modules.
            components: src('components'),
            i18n: src('i18n'),
            types: src('types'),
            utils: src('utils'),
            reducer: src('reducer.ts'),
            manifest: src('manifest.ts'),
            index: src('index.tsx'),
            'mattermost-redux': fileURLToPath(new URL('./node_modules/mattermost-redux/lib', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        clearMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['lcov', 'text-summary', 'json-summary'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/manifest.ts', 'src/types/**', 'src/**/*.test.{ts,tsx}'],
        },
    },
});
