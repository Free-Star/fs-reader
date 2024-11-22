/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'epubjs' {
  interface EpubCFI {
    start: string;
    end: string;
  }

  interface EpubMetadata {
    title: string;
    creator: string;
    description?: string;
    pubdate?: string;
    publisher?: string;
    identifier?: string;
    language?: string;
    rights?: string;
    modified_date?: string;
  }

  interface EpubRendition {
    display(target?: string | number): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    currentLocation(): Promise<any>;
  }

  class Book {
    constructor(bookPath: string | ArrayBuffer)
    ready: Promise<void>;
    loaded: {
      metadata: EpubMetadata;
      navigation: any;
      cover: string;
      resources: any;
    };
    coverUrl(): Promise<string>;
    rendition: EpubRendition;
    locations: any;
  }

  function epub(bookPath: string | ArrayBuffer): Book;
  export default epub;
} 