import { defineConfig } from 'wxt';

export default defineConfig({
    manifest: {
        name: 'asbplayer sample companion',
        description: "Sample external extension demonstrating asbplayer's external extension API",
        permissions: ['storage'],
    },
});
