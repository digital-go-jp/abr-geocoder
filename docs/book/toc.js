// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded "><a href="intro.html"><strong aria-hidden="true">1.</strong> Introduction</a></li><li class="chapter-item expanded "><a href="architecture/index.html"><strong aria-hidden="true">2.</strong> Architecture</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="architecture/overview.html"><strong aria-hidden="true">2.1.</strong> Overview</a></li><li class="chapter-item expanded "><a href="architecture/clean-architecture.html"><strong aria-hidden="true">2.2.</strong> Clean Architecture</a></li><li class="chapter-item expanded "><a href="architecture/components.html"><strong aria-hidden="true">2.3.</strong> Components</a></li><li class="chapter-item expanded "><a href="architecture/classes.html"><strong aria-hidden="true">2.4.</strong> Classes</a></li><li class="chapter-item expanded "><a href="architecture/di.html"><strong aria-hidden="true">2.5.</strong> Dependency Injection</a></li></ol></li><li class="chapter-item expanded "><a href="geocoding/index.html"><strong aria-hidden="true">3.</strong> Geocoding</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="geocoding/strategy.html"><strong aria-hidden="true">3.1.</strong> Strategy</a></li><li class="chapter-item expanded "><a href="geocoding/parallelism.html"><strong aria-hidden="true">3.2.</strong> Parallelism</a></li><li class="chapter-item expanded "><a href="geocoding/abrg2-format.html"><strong aria-hidden="true">3.3.</strong> ABRG2 Format</a></li><li class="chapter-item expanded "><a href="geocoding/finder-internals.html"><strong aria-hidden="true">3.4.</strong> Finder Internals</a></li><li class="chapter-item expanded "><a href="geocoding/fuzzy-search.html"><strong aria-hidden="true">3.5.</strong> あいまい検索</a></li><li class="chapter-item expanded "><a href="geocoding/kyoto-streets.html"><strong aria-hidden="true">3.6.</strong> 京都の通り名</a></li></ol></li><li class="chapter-item expanded "><a href="download-and-cache/index.html"><strong aria-hidden="true">4.</strong> Download &amp; Cache</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="download-and-cache/overview.html"><strong aria-hidden="true">4.1.</strong> Overview</a></li></ol></li><li class="chapter-item expanded "><a href="rest-api/index.html"><strong aria-hidden="true">5.</strong> REST API</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="rest-api/overview.html"><strong aria-hidden="true">5.1.</strong> Overview</a></li><li class="chapter-item expanded "><a href="rest-api/cli-server.html"><strong aria-hidden="true">5.2.</strong> CLI Server</a></li></ol></li><li class="chapter-item expanded "><a href="database/index.html"><strong aria-hidden="true">6.</strong> Database</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="database/schema.html"><strong aria-hidden="true">6.1.</strong> Schema / ER 図</a></li><li class="chapter-item expanded "><a href="database/columns.html"><strong aria-hidden="true">6.2.</strong> Columns 役割</a></li></ol></li><li class="chapter-item expanded "><a href="primer/index.html"><strong aria-hidden="true">7.</strong> 入門ガイド</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="primer/trie-and-search.html"><strong aria-hidden="true">7.1.</strong> Trie と探索の考え方</a></li><li class="chapter-item expanded "><a href="primer/binary-file-basics.html"><strong aria-hidden="true">7.2.</strong> バイナリファイルの基礎</a></li><li class="chapter-item expanded "><a href="primer/hashing-and-dedup.html"><strong aria-hidden="true">7.3.</strong> ハッシュと重複排除</a></li><li class="chapter-item expanded "><a href="primer/streams-and-buffers.html"><strong aria-hidden="true">7.4.</strong> ストリームと Buffer</a></li><li class="chapter-item expanded "><a href="primer/concurrency-worker-threads.html"><strong aria-hidden="true">7.5.</strong> 並列処理とWorker</a></li></ol></li><li class="chapter-item expanded "><a href="classes/index.html"><strong aria-hidden="true">8.</strong> Classes</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="classes/trie.html"><strong aria-hidden="true">8.1.</strong> Trie / Writer / Finder</a></li><li class="chapter-item expanded "><a href="classes/geocoder.html"><strong aria-hidden="true">8.2.</strong> Geocoder / Worker</a></li><li class="chapter-item expanded "><a href="classes/api.html"><strong aria-hidden="true">8.3.</strong> API Server</a></li><li class="chapter-item expanded "><a href="classes/download.html"><strong aria-hidden="true">8.4.</strong> Download / DB</a></li></ol></li><li class="chapter-item expanded "><a href="utilities/index.html"><strong aria-hidden="true">9.</strong> Utilities</a></li><li class="chapter-item expanded "><a href="operations.html"><strong aria-hidden="true">10.</strong> Operations</a></li><li class="chapter-item expanded "><a href="troubleshooting.html"><strong aria-hidden="true">11.</strong> Troubleshooting</a></li><li class="chapter-item expanded "><a href="glossary.html"><strong aria-hidden="true">12.</strong> Glossary</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
