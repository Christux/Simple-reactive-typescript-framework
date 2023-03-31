/**
 * Simple implementation of reactive patterns with examples
 *
 * Author: Christophe Rubeck
 * Date: 08/11/2021
 */

type NextCallback<T> = (value: T) => void;
type ErrorCallback = (message: string) => void;
type CompleteCallback = () => void;

/************
 * Observer *
 ************/
export class Observer<T> {
  constructor(
    private _next?: NextCallback<T>,
    private _error?: ErrorCallback,
    private _complete?: CompleteCallback
  ) {}

  next: NextCallback<T> = (value: T): void => {
    if (this._next) {
      this._next(value);
    }
  };

  error: ErrorCallback = (message: string): void => {
    if (this._error) {
      this._error(message);
    }
  };

  complete: CompleteCallback = (): void => {
    if (this._complete) {
      this._complete();
    }
  };
}

/***********
 * Subject *
 ***********/
export class Subject<T> {
  private observers: Observer<T>[] = [];

  next(value: T) {
    this.observers.forEach(observer => observer.next(value));
  }

  error(err: string) {
    this.observers.forEach(observer => observer.error(err));
  }

  complete() {
    this.observers.forEach(observer => observer.complete());
  }

  asObservable() {
    return new Observable((obs: Observer<T>) =>
      this.subscribe(obs.next, obs.error, obs.complete)
    );
  }

  subscribe(
    next?: NextCallback<T>,
    error?: ErrorCallback,
    complete?: CompleteCallback
  ): Subscription {
    const observer = new Observer(next, error, complete);
    this.observers.push(observer);

    return new Subscription(
      () => (this.observers = this.observers.filter((obs) => obs !== observer))
    );
  }
}

/****************
 * Subscription *
 ****************/
export class Subscription {
  constructor(public dispose: () => void) {}
}

/**************
 * Observable *
 **************/
export class Observable<T> {
  constructor(private _subscribe: (observer: Observer<T>) => Subscription) {}

  subscribe(
    next?: NextCallback<T>,
    error?: ErrorCallback,
    complete?: CompleteCallback
  ): Subscription {
    return this._subscribe(new Observer(next, error, complete));
  }

  /**
   * Takes n first values then disposes the source observable
   *
   * 0-1-2-3-4-5--->
   *
   *   take(3)
   *
   * 0-1-2-|------->
   *
   */
  take(n: number): Observable<T> {
    return new Observable((obs: Observer<T>) => {
      const observer = new Observer(obs.next, obs.error, obs.complete);
      let i = 0;

      const subscription = this.subscribe(
        (value) => {
          if (i < n - 1) {
            observer.next(value);
          }

          if (i === n - 1) {
            observer.next(value);
            observer.complete();
            subscription.dispose();
          }

          i++;
        },
        observer.error,
        observer.complete
      );

      return new Subscription(() => {
        subscription.dispose();
      });
    });
  }

  /**
   * Do something on each value from stream without modifying the stream
   *
   * 0-1-2-3-4-5--->
   *
   * do(x -> console.log(x))
   *
   * 0-1-2-3-4-5--->
   */
  do(
    next?: NextCallback<T>,
    error?: ErrorCallback,
    complete?: CompleteCallback
  ): Observable<T> {
    return new Observable((obs: Observer<T>) => {
      const observer = new Observer(obs.next, obs.error, obs.complete);
      const toDo = new Observer(next, error, complete);
      const subscription = this.subscribe(
        (value) => {
          toDo.next(value);
          observer.next(value);
        },
        (err) => {
          toDo.error(err);
          observer.error(err);
        },
        () => {
          toDo.complete();
          observer.complete();
        }
      );

      return new Subscription(() => {
        subscription.dispose();
      });
    });
  }

  /**
   * Maps each resulting value from stream
   *
   * 0-1-2-3-4-5--->
   *
   * map(x -> x * 2)
   *
   * 0-2-4-6-8-10--->
   */
  map<U>(map: (value: T) => U): Observable<U> {
    return new Observable<U>((obs: Observer<U>) => {
      const observer = new Observer(obs.next, obs.error, obs.complete);

      const subscription = this.subscribe(
        (value) => observer.next(map(value)),
        observer.error,
        observer.complete
      );

      return new Subscription(() => {
        subscription.dispose();
      });
    });
  }

  /**
   * Transform values of source bservables into new observables and merges them.
   *
   * 0-1-|-------->
   *
   * mergeMap(x -> from([x, x*2]))
   *
   * 0-0-1-2-|---->
   */
  mergeMap<U>(mergeMap: (value: T) => Observable<U>): Observable<U> {
    return new Observable((obs: Observer<U>) => {
      const observer = new Observer(obs.next, obs.error, obs.complete);
      const subscriptions: Subscription[] = [];
      let completeCount = 0;

      subscriptions.push(
        this.subscribe(
          (value) => {
            subscriptions.push(
              mergeMap(value).subscribe(
                (value) => observer.next(value),
                error,
                complete
              )
            );
          },
          error,
          complete
        )
      );

      return new Subscription(() => {
        subscriptions.forEach((subscription) => {
          subscription.dispose();
        });
      });

      function error(err) {
        observer.error(err);
      }

      function complete() {
        completeCount++;
        if (completeCount === subscriptions.length) {
          observer.complete();
        }
      }
    });
  }

  /**
   * Joins all values in a single array
   *
   * 0-1-2-3-|---->
   *
   * join()
   *
   * -------[0,1,2,3]-|->
   */
  join(): Observable<T[]> {
    return new Observable((obs: Observer<T[]>) => {
      const observer = new Observer(obs.next, obs.error, obs.complete);
      const values: T[] = [];

      const subscription = this.subscribe(
        (value) => values.push(value),
        observer.error,
        () => {
          observer.next(values);
          observer.complete();
        }
      );

      return new Subscription(() => {
        subscription.dispose();
      });
    });
  }
}

/**********************
 * Creation functions *
 **********************/

/**
 * Creates an empty stream
 *
 * -|---------------->
 */
export function empty(): Observable<unknown> {
  return new Observable((obs: Observer<unknown>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    let isdisposed = false;

    // Complete imediately
    observer.complete();

    return new Subscription(() => {
      if (!isdisposed) {
        isdisposed = true;
      }
    });
  });
}

/**
 * Creates an one valued stream
 *
 * of(5)
 *
 * -5-|------------------>
 */
export function of<T>(value: T): Observable<T> {
  return new Observable<T>((obs: Observer<T>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    let isdisposed = false;

    setTimeout(() => {
      observer.next(value);
      observer.complete();
    }, 0);

    return new Subscription(() => {
      if (!isdisposed) {
        isdisposed = true;
      }
    });
  });
}

/**
 * Creates a stream from an array
 *
 * from([3,8,5,1])
 *
 * -3-8-5-1-|-------->
 */
export function from<T>(values: T[]): Observable<T> {
  return new Observable<T>((obs: Observer<T>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    let isdisposed = false;

    setTimeout(() => {
      values.forEach(function (value) {
        if (!isdisposed) observer.next(value);
      });

      if (!isdisposed) observer.complete();
    }, 0);

    return new Subscription(() => {
      if (!isdisposed) {
        isdisposed = true;
      }
    });
  });
}

/**
 * Creates a stream from a range
 *
 * range(4,8)
 *
 * -4-5-6-7-8-|--->
 */
export function range(min: number, max: number): Observable<number> {
  let values: number[] = [];

  for (let i = min; i <= max; i++) {
    values.push(i);
  }

  return from(values);
}

/**
 * Creates a stream from interval
 *
 * -0-1-2-3-4-5-6----->
 */
export function interval(period: number): Observable<number> {
  return new Observable((obs: Observer<number>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    let intervalHandler: number;
    let isdisposed = false;
    let i = 0;

    intervalHandler = setInterval(() => {
      observer.next(i);
      i++;
    }, period);

    return new Subscription(() => {
      if (!isdisposed) {
        clearInterval(intervalHandler);
        isdisposed = true;
      }
    });
  });
}

/**
 * Merges multiple streams
 *
 * 3---4---4-|-------->
 *
 * merge(
 * --2---3---2-|------>,
 * --------------0-|-->
 * )
 *
 * 3-2-4-3-4-2---0-|->
 */
export function merge<T>(...observables: Observable<T>[]): Observable<T> {
  return new Observable((obs: Observer<T>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    const subscriptions: Subscription[] = [];
    let completeCount = 0;

    observables.forEach((source) => {
      subscriptions.push(
        source.subscribe(
          observer.next,
          observer.error,
          () => {
            completeCount++;
            if (completeCount === subscriptions.length) {
              observer.complete();
            }
          }
        )
      );
    });

    return new Subscription(() => {
      subscriptions.forEach(subscription => 
        subscription.dispose()
      );
    });
  });
}

/**
 * Creates a stream from an event
 */
export function fromEvent(
  element: Element,
  eventName: string
): Observable<Event> {
  return new Observable((obs: Observer<Event>) => {
    const observer = new Observer(obs.next, obs.error, obs.complete);
    let isdisposed = false;

    let eventHandler = (event: Event) => {
      observer.next(event);
    };

    element.addEventListener(eventName, eventHandler);

    return new Subscription(() => {
      if (!isdisposed) {
        element.removeEventListener(eventName, eventHandler);
        isdisposed = true;
      }
    });
  });
}
