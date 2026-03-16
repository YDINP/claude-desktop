chunk-5B54REGN.js?v=095af453:21551 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
chunk-5B54REGN.js?v=095af453:521 Warning: Updating a style property during rerender (borderBottom) when a conflicting property is set (border) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.
    at button
    at div
    at div
    at div
    at div
    at AppContent (http://localhost:5173/src/App.tsx:632:19)
    at ProjectProvider (http://localhost:5173/src/stores/project-store.ts:3:35)
    at App
printWarning @ chunk-5B54REGN.js?v=095af453:521
Show 1 more frame
Show less
chunk-5B54REGN.js?v=095af453:521 Warning: React has detected a change in the order of Hooks called by CCFileAssetBrowser. This will lead to bugs and errors if not fixed. For more information, read the Rules of Hooks: https://reactjs.org/link/rules-of-hooks

   Previous render            Next render
   ------------------------------------------------------
1. useState                   useState
2. useState                   useState
3. useState                   useState
4. useState                   useState
5. useState                   useState
6. useState                   useState
7. useState                   useState
8. useState                   useState
9. useState                   useState
10. useRef                    useRef
11. useMemo                   useMemo
12. useCallback               useCallback
13. useCallback               useCallback
14. useCallback               useCallback
15. useCallback               useCallback
16. useEffect                 useEffect
17. useMemo                   useMemo
18. useCallback               useCallback
19. useCallback               useCallback
20. useCallback               useCallback
21. useCallback               useCallback
22. useCallback               useCallback
23. undefined                 useMemo
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

    at CCFileAssetBrowser (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:40447:3)
    at div
    at CCFileProjectUI (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:387:28)
    at CocosPanel (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:113:23)
    at div
    at div
    at div
    at div
    at div
    at div
    at AppContent (http://localhost:5173/src/App.tsx:632:19)
    at ProjectProvider (http://localhost:5173/src/stores/project-store.ts:3:35)
    at App
printWarning @ chunk-5B54REGN.js?v=095af453:521
Show 1 more frame
Show less
2chunk-5B54REGN.js?v=095af453:11678 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (chunk-5B54REGN.js?v=095af453:11678:21)
    at updateMemo (chunk-5B54REGN.js?v=095af453:12199:22)
    at Object.useMemo (chunk-5B54REGN.js?v=095af453:12726:24)
    at useMemo (chunk-UBEI3PWW.js?v=095af453:1094:29)
    at CCFileAssetBrowser (CocosPanel.tsx:21192:22)
    at renderWithHooks (chunk-5B54REGN.js?v=095af453:11548:26)
    at updateFunctionComponent (chunk-5B54REGN.js?v=095af453:14582:28)
    at beginWork (chunk-5B54REGN.js?v=095af453:15924:22)
    at HTMLUnknownElement.callCallback2 (chunk-5B54REGN.js?v=095af453:3674:22)
    at Object.invokeGuardedCallbackDev (chunk-5B54REGN.js?v=095af453:3699:24)
chunk-5B54REGN.js?v=095af453:14032 The above error occurred in the <CCFileAssetBrowser> component:

    at CCFileAssetBrowser (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:40447:3)
    at div
    at CCFileProjectUI (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:387:28)
    at CocosPanel (http://localhost:5173/src/components/sidebar/CocosPanel.tsx:113:23)
    at div
    at div
    at div
    at div
    at div
    at div
    at AppContent (http://localhost:5173/src/App.tsx:632:19)
    at ProjectProvider (http://localhost:5173/src/stores/project-store.ts:3:35)
    at App

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.
logCapturedError @ chunk-5B54REGN.js?v=095af453:14032
Show 1 more frame
Show less
chunk-5B54REGN.js?v=095af453:19413 Uncaught Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (chunk-5B54REGN.js?v=095af453:11678:21)
    at updateMemo (chunk-5B54REGN.js?v=095af453:12199:22)
    at Object.useMemo (chunk-5B54REGN.js?v=095af453:12726:24)
    at useMemo (chunk-UBEI3PWW.js?v=095af453:1094:29)
    at CCFileAssetBrowser (CocosPanel.tsx:21192:22)
    at renderWithHooks (chunk-5B54REGN.js?v=095af453:11548:26)
    at updateFunctionComponent (chunk-5B54REGN.js?v=095af453:14582:28)
    at beginWork (chunk-5B54REGN.js?v=095af453:15924:22)
    at beginWork$1 (chunk-5B54REGN.js?v=095af453:19753:22)
    at performUnitOfWork (chunk-5B54REGN.js?v=095af453:19198:20)