import Player from "../../player";
import { IViewPoint } from "../user";
import "../../../css/view-point.less";
import STATE from "../state";

let videoDuration: number;
let trackerWrp: HTMLElement;
let handleWidth: number;
let sliderTracker: HTMLDivElement;
let sliderBar: HTMLDivElement;

function initSharedTools(player: Player) {
    handleWidth = (<HTMLDivElement>player.template.controller.find(".bpui-slider-handle")[0]).clientWidth;
    trackerWrp = <HTMLDivElement>player.template.controller.find(".bpui-slider-tracker-wrp")[0];
    videoDuration = player.duration()!;
}
function Time2Pos(time: number) {
    return time / videoDuration * (trackerWrp.clientWidth - handleWidth) + handleWidth / 2 + "px";
}
function Mouse2Pos(e: MouseEvent) {
    const box = sliderBar.getBoundingClientRect();
    let pos = (e.pageX - (box.left + window.scrollX - document.body.clientLeft) - handleWidth / 2)
              / (trackerWrp.clientWidth - handleWidth) * videoDuration;
    if (pos < 0) pos = 0;
    if (pos > videoDuration) pos = videoDuration;
    return pos;
}
function divWithClass(cls: string) {
    const d = document.createElement("div");
    d.className = cls;
    return d;
}

class ViewPointList {
    private listItems: HTMLLIElement[] = [];
    private vpUI: { info: IViewPoint; el: HTMLElement }[];
    private type: number;
    private chptName!: HTMLDivElement;
    private listUL!: HTMLUListElement;
    private progressDetail!: HTMLDivElement;
    private $listWrap!: JQuery<HTMLElement>;
    private lastActiveIndex = -1;
    private hasSyncedActiveIndex = false;
    private autoSwitchFadeDuration = 150;

    constructor(private player: Player, private viewPoints: IViewPoint[]) {
        sliderTracker = <HTMLDivElement>player.template.controller
            .find(".bilibili-player-video-progress .bpui-slider-tracker")[0];
        sliderBar = <HTMLDivElement>player.template.controller
            .find(".bilibili-player-video-progress-bar")[0];
        initSharedTools(player);

        this.initPanelUI();
        this.bindEvents();

        this.type = viewPoints[0].type;
        this.vpUI = [];
        for (const v of viewPoints) {
            let marker: BaseViewPoint | undefined;
            if (this.type === 1) marker = new eSportViewPoint(v, player);
            else if (this.type === 2) marker = new CommonViewPoint(v);
            if (marker) {
                this.vpUI.push({ info: v, el: marker.ui });
                sliderTracker.appendChild(marker.ui);
            }
        }
        if (this.type === 1) this.arrangeEsportVP();
        else if (this.type === 2) this.arrangeCommonVP();
    }

    private arrangeCommonVP() {
        const duration = this.vpUI[this.vpUI.length - 1].info.to;
        const total = this.vpUI.length;
        for (let i = 0; i < total; i++) {
            const vp = this.vpUI[i];
            const ui = vp.el;
            ui.className = "bilibili-progress-segmentation";
            // 标记首尾分段，CSS 凭此决定是否显示首/尾边界线
            if (i === 0) ui.classList.add("is-first");
            if (i === total - 1) ui.classList.add("is-last");
            const ratio = videoDuration / duration / duration;
            ui.style.width = (vp.info.to - vp.info.from) * ratio * 100 + "%";
            ui.style.left  = vp.info.from * ratio * 100 + "%";
            ui.innerHTML   = "<div><div></div></div>";
            ui.onmouseenter = () => { this.setPreviewChapter(vp.info.content); };
            ui.onmouseleave = () => { this.setPreviewChapter(""); };
        }
                
        const updateLayout = () => {
            const duration = this.player.duration() || videoDuration;
            if (duration <= 0) return;
            
            const W = trackerWrp.clientWidth;
            const hw = handleWidth || 14;
            if (W <= hw) return;
            
            const halfHw = hw / 2;
            const usable = W - hw;
            
            const timePoints: number[] = [];
            for (const vp of this.vpUI) {
                timePoints.push(vp.info.from);
            }
            timePoints.push(this.vpUI[this.vpUI.length - 1].info.to);
            
            const pixelPoints = timePoints.map(t => t / duration * usable + halfHw);
            
            for (let i = 0; i < this.vpUI.length; i++) {
                const vp = this.vpUI[i];
                let leftEdge = pixelPoints[i];
                let rightEdge = pixelPoints[i + 1];
                
                if (vp.el.classList.contains("is-first")) {
                    leftEdge = 0;
                }
                if (vp.el.classList.contains("is-last")) {
                    rightEdge = W;
                }
                
                vp.el.style.left = leftEdge + "px";
                vp.el.style.width = (rightEdge - leftEdge) + "px";
            }
        };
        
        setTimeout(() => updateLayout());
        this.player.bind(STATE.EVENT.VIDEO_PLAYER_RESIZE, () => updateLayout());
        trackerWrp.addEventListener("mouseleave", () => this.setPreviewChapter(""));
    }

    private arrangeEsportVP() {
        const update = () => {
            for (const vp of this.vpUI) vp.el.style.left = Time2Pos(vp.info.to);
        };
        setTimeout(() => update(), 500);

        const playerArea = <HTMLElement>document.getElementsByClassName("bilibili-player-area")[0];
        let visibility = true;
        const hide = () => {
            if (!visibility) return;
            visibility = false;
            this.setPreviewChapter("");
            for (const vp of this.vpUI) vp.el.style.opacity = "0";
            setTimeout(() => { for (const vp of this.vpUI) vp.el.style.visibility = "hidden"; }, 100);
        };
        playerArea.addEventListener("mouseleave", () => hide());
        playerArea.addEventListener("mousemove", e => {
            const r = playerArea.getBoundingClientRect();
            if (e.pageY < r.top + window.scrollY + r.height * 0.65) {
                hide();
            } else {
                visibility = true;
                for (const vp of this.vpUI) { vp.el.style.visibility = ""; vp.el.style.opacity = "1"; }
            }
        });
        trackerWrp.addEventListener("mousemove", e => {
            let closestPoint = 1e6;
            const pos = Mouse2Pos(e);
            const thumbnailArea = 80 / (trackerWrp.clientWidth - handleWidth) * videoDuration;
            const hitArea = trackerWrp.clientWidth > 400 ? thumbnailArea / 10 : thumbnailArea / 20;
            for (const vp of this.vpUI) {
                vp.el.style.zIndex = "";
                if (vp.info.to >= pos - hitArea && vp.info.to <= pos + hitArea
                    && Math.abs(vp.info.to - pos) < closestPoint) {
                    this.setPreviewChapter(vp.info.content);
                    closestPoint = Math.abs(vp.info.to - pos);
                    vp.el.style.zIndex = "1000";
                }
            }
            if (closestPoint === 1e6) this.setPreviewChapter("");
        });
        this.player.bind(STATE.EVENT.VIDEO_PLAYER_RESIZE, () => update());
        trackerWrp.addEventListener("mouseleave", () => {
            this.setPreviewChapter("");
            for (const vp of this.vpUI) vp.el.className = "bilibili-progress-segmentation-logo";
        });
    }

    private setPreviewChapter(content: string) {
        const text = content ? content.trim() : "";
        this.chptName.textContent = text;
        this.progressDetail.classList.toggle("bilibili-player-video-progress-detail-has-chapter", !!text);
    }

    private initPanelUI() {
        this.chptName = divWithClass("bilibili-progress-detail-chapter bilibili-progress-detail-chapter-preview");
        this.progressDetail = <HTMLDivElement>document.querySelector(".bilibili-player-video-progress-detail");
        this.progressDetail.appendChild(this.chptName);

        const wrapList = <HTMLDivElement>document.querySelector("div.bilibili-player-wraplist");
        const panels   = wrapList.children;

        const chptPanel = divWithClass("bilibili-player-filter-wrap bilibili-player-chapterList");
        chptPanel.style.display = "none";
        wrapList.appendChild(chptPanel);

        const listWrap = divWithClass("bilibili-player-viewpoint-wrap");
        chptPanel.appendChild(listWrap);

        this.listUL = document.createElement("ul");
        this.listUL.className = "bilibili-player-viewpoint-list";
        listWrap.appendChild(this.listUL);

        const chptBtn = divWithClass(
            "bilibili-player-filter-btn bilibili-player-filter-chapter bpui-component bpui-button bpui-button-type-small button"
        );
        chptBtn.innerHTML = `<span class="bpui-button-text"><span>视频看点</span></span>`;
        document.querySelector(`div.bilibili-player-filter`)!.appendChild(chptBtn);

        this.$listWrap = $(listWrap);
        this.$listWrap.mCustomScrollbar({
            axis: "y",
            scrollInertia: 100,
            autoHideScrollbar: true,
            mouseWheel: {
                scrollAmount: 80,
                preventDefault: false,
            },
        });

        chptBtn.onclick = () => {
            const activePanel = <HTMLDivElement>document.querySelector(`div.bilibili-player-filter-btn.active`);
            if (activePanel === chptBtn) return;
            activePanel.classList.remove("active");
            chptBtn.classList.add("active");
            for (let i = 0; i < panels.length; i++) {
                const el = <HTMLDivElement>panels[i];
                if (el.style.display === "block") { el.style.display = "none"; break; }
            }
            if (this.listItems.length === 0) {
                this.viewPoints.forEach((v, i) => {
                    const li = this.buildListItem(v, i);
                    this.listItems.push(li);
                    this.listUL.appendChild(li);
                });
            }
            chptPanel.style.display = "block";
            this.$listWrap.mCustomScrollbar("update");
            this.refreshPanel();
        };
        chptPanel.onmouseenter = () => this.refreshPanel();
    }

    private fmTime(sec: number) {
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    }

    private buildListItem(v: IViewPoint, index: number): HTMLLIElement {
        const li = document.createElement("li");
        li.className = "bilibili-player-viewpoint-item";
        li.dataset.index = String(index);
        li.setAttribute("data-state-play", "false");

        li.innerHTML = `
            <div class="bilibili-player-viewpoint-item-sup clearfix">
                <div class="bilibili-player-viewpoint-order-cell bilibili-player-fl">
                    <div class="bilibili-player-viewpoint-order-number">${index + 1}</div>
                    <div class="bilibili-player-viewpoint-order-play">
                        <i class="bilibili-player-iconfont icon-12toview-play"></i>
                    </div>
                </div>
                <div class="bilibili-player-viewpoint-cover-cell bilibili-player-fl">
                    ${v.imgUrl
                        ? `<img src="${v.imgUrl}" alt="${v.content}">`
                        : `<div class="bilibili-player-viewpoint-cover-placeholder"></div>`
                    }
                </div>
                <div class="bilibili-player-viewpoint-info-cell bilibili-player-fl">
                    <div class="bilibili-player-viewpoint-info-title" title="${v.content}">${v.content}</div>
                    <div class="bilibili-player-viewpoint-info-other">
                        <div class="bilibili-player-viewpoint-info-time bilibili-player-fl">${this.fmTime(v.from)}</div>
                        <div class="bilibili-player-viewpoint-info-playing bilibili-player-fr">播放中</div>
                    </div>
                </div>
            </div>`;

        li.addEventListener("click", () => {
            this.player.seek(v.from);
            this.setActiveItem(index, false);
        });

        return li;
    }

    private setActiveItem(index: number, withTransition = true) {
        const changed = index !== this.lastActiveIndex;
        this.listItems.forEach((li, i) => {
            li.setAttribute("data-state-play", i === index ? "true" : "false");
        });
        if (!this.hasSyncedActiveIndex) {
            this.hasSyncedActiveIndex = true;
            this.lastActiveIndex = index;
            return;
        }
        if (!changed) return;
        this.lastActiveIndex = index;
        if (index >= 0) {
            if (withTransition) this.playAutoSwitchTransition(index);
            this.scrollToActiveItem(index);
        }
    }

    private playAutoSwitchTransition(index: number) {
        const item = this.listItems[index];
        if (!item || item.matches(":hover") || typeof item.animate !== "function") return;
        item.animate(
            [
                { backgroundColor: "rgba(229, 245, 251, 0)" },
                { backgroundColor: "rgba(229, 245, 251, 1)" },
            ],
            {
                duration: this.autoSwitchFadeDuration,
                easing: "linear",
            }
        );
    }

    private scrollToActiveItem(index: number) {
        if (!this.$listWrap || !this.$listWrap.is(":visible")) return;
        const item = this.listItems[index];
        if (!item) return;

        const $item = $(item);
        const contentContainer = this.$listWrap.find(".mCSB_container");
        const baseEl = contentContainer.length ? contentContainer : this.$listWrap;
        const top = $item.offset()!.top - baseEl.offset()!.top;
        const prevItem = $item.prev(".bilibili-player-viewpoint-item");
        const prevHeight = prevItem.length ? prevItem.outerHeight()! : $item.outerHeight()!;
        const targetTop = Math.max(0, top - prevHeight);

        this.$listWrap.mCustomScrollbar("scrollTo", targetTop + "px", {
            scrollInertia: 260,
            scrollEasing: "easeOut",
            timeout: 0,
        });
    }

    private bindEvents() {
        this.player.bind(STATE.EVENT.VIDEO_MEDIA_TIME,   () => this.refreshPanel());
        this.player.bind(STATE.EVENT.VIDEO_MEDIA_SEEKED, () => this.refreshPanel());
    }

    private refreshPanel() {
        if (this.listItems.length === 0) return;
        const progress = this.player.currentTime() || 0;
        let activeIndex = -1;

        if (this.type === 1) {
            let minDist = 1e6;
            this.viewPoints.forEach((v, i) => {
                const d = Math.abs(progress - v.to);
                if (d < 5 && d < minDist) { minDist = d; activeIndex = i; }
            });
        } else {
            for (let i = 0; i < this.viewPoints.length; i++) {
                if (progress < this.viewPoints[i].to) { activeIndex = i; break; }
            }
        }
        this.setActiveItem(activeIndex);
    }
}

class BaseViewPoint {
    ui: HTMLElement;
    constructor(className: string, _v: IViewPoint) {
        this.ui = document.createElement("div");
        this.ui.className = className;
    }
}

class eSportViewPoint extends BaseViewPoint {
    constructor(v: IViewPoint, player: Player) {
        super("bilibili-progress-segmentation-logo", v);

        let img: HTMLImageElement | SVGSVGElement;
        if (v.logoUrl) {
            img = <HTMLImageElement>document.createElement("img");
            img.id = "segmentation-logo"; img.width = 32; img.height = 36; img.src = v.logoUrl;
        } else {
            img = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            img.setAttribute("viewBox", "0 -3 32 36");
            img.innerHTML = `
            <defs><radialGradient id="gradient">
                <stop offset="10%" stop-color="#ffe78f"/>
                <stop offset="40%" stop-color="#ffe996"/>
                <stop offset="95%" stop-color="#fcecae"/>
            </radialGradient></defs>
            <path style="fill:rgb(252,236,174);stroke:rgb(252,236,174)"
                d="M16 32.097C13.312 32.106 10.608 30.145 11 25.897C11.265 22.744 16 17.097 16 17.097
                   C16 17.097 20.822 22.697 21.022 25.897C21.322 30.097 18.801 32.088 16 32.097Z"
                transform="matrix(-1,0,0,-1,32.021761,49.196602)"/>
            <circle cx="16" cy="22" r="5" fill="url(#gradient)"/>`;
        }
        img.addEventListener("click",      () => player.seek(v.from));
        this.ui.appendChild(img);
    }
}

class CommonViewPoint extends BaseViewPoint {
    constructor(v: IViewPoint) { super("bilibili-progress-segmentation", v); }
}

export default ViewPointList;
