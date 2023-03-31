import { merge, Observable, Observer, Subscription } from "./reactive";

export function $(selector: string): ElementWrapper | ElementWrapperCollection {
  return select(document, selector);
}

function select(
  element: Element | Document,
  selector: string
): ElementWrapper | ElementWrapperCollection {
  // By Id
  if (/\#(.*)/.test(selector)) {
    const id = /\#(.*)/.exec(selector)[1];
    const element: HTMLElement | null = document.getElementById(id);

    if (element) {
      return new ElementWrapper(element);
    }

    throw new Error(`Element with id ${id} not found`);

    // By class name
  } else if (/\.(.*)/.test(selector)) {
    const className = /\.(.*)/.exec(selector)[1];
    return elementCollectionFromHTML(element.getElementsByClassName(className));
  }

  // By tag name
  return elementCollectionFromHTML(element.getElementsByTagName(selector));
}

function elementCollectionFromHTML(
  htmlElements: HTMLCollectionOf<Element>
): ElementWrapperCollection {
  const elements: ElementWrapper[] = [];

  for (const htmlElement of htmlElements) {
    elements.push(new ElementWrapper(htmlElement as HTMLElement));
  }

  return new ElementWrapperCollection(elements);
}

class ElementWrapper {
  private display: string | null = null;

  constructor(public readonly nativeElement: HTMLElement) {}

  get id(): string | null {
    return this.nativeElement.id ?? null;
  }

  select(selector: string): ElementWrapper | ElementWrapperCollection {
    return select(this.nativeElement, selector);
  }

  appendToParent(parentElement: ElementWrapper): ElementWrapper {
    parentElement.nativeElement.appendChild(this.nativeElement);
    return this;
  }

  add(element: ElementWrapper): ElementWrapperCollection {
    return new ElementWrapperCollection([this, element]);
  }

  css(property: string, value: string): ElementWrapper {
    this.nativeElement.style[property] = value;
    return this;
  }

  hide(): ElementWrapper {
    if (this.nativeElement.style.display !== 'none') {
      this.display = this.nativeElement.style.display;
      this.nativeElement.style.display = 'none';
    }
    return this;
  }

  show(): ElementWrapper {
    if (this.display) {
      if (this.nativeElement.style.display === 'none') {
        this.nativeElement.style.display = this.display;
        this.display = null;
      }
    } else {
      this.nativeElement.style.display = 'initial';
    }

    return this;
  }

  addEventListener(
    eventName: string,
    callback: (event: Event, element: ElementWrapper) => void
  ): ElementWrapper {
    this.nativeElement.addEventListener(eventName, (event) =>
      callback(event, this)
    );
    return this;
  }

  addEventListener$(eventName: string): Observable<{event: Event, element: ElementWrapper}> {
    
    let isdisposed = false;
    let eventHandler: ((event: Event) => void) | null = null;

    return new Observable((obs: Observer<{event: Event, element: ElementWrapper}>) => {

      const observer = new Observer(obs.next, obs.error, obs.complete);
  
      eventHandler = (event) => {
        observer.next({event, element: this});
      }
  
      this.nativeElement.addEventListener(eventName, eventHandler);
  
      return new Subscription(() => {
        if (!isdisposed) {
          this.nativeElement.removeEventListener(eventName, eventHandler);
          isdisposed = true;
        }
      });
    });
  }

  click(
    callback: (event: Event, element: ElementWrapper) => void
  ): ElementWrapper {
    return this.addEventListener('click', callback);
  }

  click$(): Observable<{event: Event, element: ElementWrapper}> {
    return this.addEventListener$('click');
  }

  hasClass(className: string): boolean {
    return this.nativeElement.classList.contains(className);
  }

  addClass(className: string): ElementWrapper {
    if (!this.nativeElement.classList.contains(className)) {
      this.nativeElement.classList.add(className);
    }
    return this;
  }

  removeClass(className): ElementWrapper {
    if (this.nativeElement.classList.contains(className)) {
      this.nativeElement.classList.remove(className);
    }
    return this;
  }

  text(text: string): ElementWrapper {
    this.nativeElement.innerText = text;
    return this;
  }

  html(html: string): ElementWrapper {
    this.nativeElement.innerHTML = html;
    return this;
  }

  offsetTop(): number {
    return this.nativeElement.offsetTop;
  }

  offsetBottom(): number {
    return this.nativeElement.offsetTop + this.nativeElement.clientHeight;
  }

  attribute(name: string): string | null {
    if (this.nativeElement.hasAttribute(name)) {
      return this.nativeElement.getAttribute(name);
    }
    return null;
  }

  first(): ElementWrapper | null {
    return this;
  }

  forEach(callback: (elements: ElementWrapper, idx: number) => void): void {
    callback(this, 0);
  }

  filter(
    callback: (elements: ElementWrapper, idx: number) => boolean
  ): ElementWrapperCollection {
    return new ElementWrapperCollection([this]).filter(callback);
  }

  count(): number {
    throw new Error(`Count method is not available on element`);
  }
}

class ElementWrapperCollection {
  constructor(private readonly elements: ElementWrapper[] = []) {}

  get id(): string | null {
    throw new Error(`Id is not available on collection`);
  }

  select(selector: string): ElementWrapperCollection {
    throw new Error(`Select method is not available on collection`);
  }

  appendToParent(parentElement: ElementWrapper): ElementWrapperCollection {
    this.forEach((element) =>
      parentElement.nativeElement.appendChild(element.nativeElement)
    );
    return this;
  }

  add(element: ElementWrapper): ElementWrapperCollection {
    this.elements.push(element);
    return this;
  }

  css(property: string, value: string): ElementWrapperCollection {
    this.forEach((element) => element.css(property, value));
    return this;
  }

  hide(): ElementWrapperCollection {
    this.forEach((element) => element.hide());
    return this;
  }

  show(): ElementWrapperCollection {
    this.forEach((element) => element.show());
    return this;
  }

  addEventListener(
    eventName: string,
    callback: (event: Event, element: ElementWrapper) => void
  ): ElementWrapperCollection {
    this.forEach((element) => element.addEventListener(eventName, callback));
    return this;
  }

  addEventListener$(eventName: string): Observable<{event: Event, element: ElementWrapper}> {
    const observables = this.elements.map(element => element.addEventListener$(eventName));
    return merge.apply(this, observables);
  }

  click(
    callback: (event: Event, element: ElementWrapper) => void
  ): ElementWrapperCollection {
    this.forEach((element) => element.click(callback));
    return this;
  }

  click$(): Observable<{event: Event, element: ElementWrapper}> {
    return this.addEventListener$('click');
  }

  hasClass(className: string): boolean {
    throw new Error(`HasClass method is not available on collection`);
  }

  addClass(className: string): ElementWrapperCollection {
    this.forEach((element) => element.addClass(className));
    return this;
  }

  removeClass(className: string): ElementWrapperCollection {
    this.forEach((element) => element.removeClass(className));
    return this;
  }

  text(text: string): ElementWrapperCollection {
    this.forEach((element) => element.text(text));
    return this;
  }

  html(html: string): ElementWrapperCollection {
    this.forEach((element) => element.html(html));
    return this;
  }

  offsetTop(): number {
    throw new Error(`OffsetTop method is not available on collection`);
  }

  offsetBottom(): number {
    throw new Error(`OffsetBottom method is not available on collection`);
  }

  attribute(name: string): string | null {
    throw new Error(`Attribute method is not available on collection`);
  }

  first(): ElementWrapper | null {
    return this.elements[0] ?? null;
  }

  forEach(callback: (elements: ElementWrapper, idx: number) => void): void {
    this.elements.forEach((element, idx) => callback(element, idx));
  }

  filter(
    callback: (elements: ElementWrapper, idx: number) => boolean
  ): ElementWrapperCollection {
    const filtered: ElementWrapper[] = [];

    this.forEach((element, idx) => {
      if (callback(element, idx)) {
        filtered.push(element);
      }
    });

    return new ElementWrapperCollection(filtered);
  }

  count(): number {
    return this.elements.length;
  }
}
