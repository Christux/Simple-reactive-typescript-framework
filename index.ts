import { $ } from './core/dom';
import { from, interval, of } from './core/reactive';
import './style.scss';

$('#app').html(`<h1>TypeScript Starter</h1>`).first();

//of(45)
from([2, 6, 4])
  .map((v) => v * 2)
  .subscribe(console.log);

$('#btn1').click((event, element) => console.log(element.id));

$('#btn2')
  .addClass('active')
  .click$()
  .subscribe(({ event, element }) => console.log(element.id));

$('button')
  .click$()
  .do(console.log)
  .subscribe(({ event, element }) => console.log(element.id));

interval(500)
  .mergeMap((i) => of(i))
  .take(10)
  .join()
  .subscribe(console.log);
