import './styles.scss';
import 'bootstrap';

// import keyBy from 'lodash/keyBy.js';
import uniqueId from 'lodash/uniqueId.js';
import i18next from 'i18next';
import axios from 'axios';
// import validate from './validator.js';
import * as yup from 'yup';
import resources from './locales/index.js';
import watch from './view.js';

const proxifyUrl = (rssUrl) => {
  const url = new URL('https://allorigins.hexlet.app/');
  url.pathname = '/get';
  url.search = `disableCache=true&url=${encodeURIComponent(rssUrl)}`;
  return url;
};

const validate = (state) => {
  yup.setLocale({
    string: {
      url: () => ({ key: 'feedback.error.notValidURL', type: 'error' }),
    },
  });

  const schema = yup.object().shape(
    {
      rssUrl: yup.string().url(),
    },
  );

  return schema.validate(state.form.fields, { abortEarly: false });
};

const pars = (XMLdata) => {
  const rss = new window.DOMParser().parseFromString(XMLdata, 'text/xml');
  if (!rss.querySelector('channel')) { throw new Error('Parse error!'); }
  const feed = {
    id: uniqueId(),
    title: rss.querySelector('title').textContent,
    description: rss.querySelector('description').textContent,
  };
  const rssItems = Array.from(rss.querySelectorAll('item'));
  const posts = rssItems.map((item) => ({
    id: feed.id,
    postId: uniqueId(),
    title: item.querySelector('title').textContent,
    description: item.querySelector('description').textContent,
    link: item.querySelector('link').textContent,
  }));
  return { feed, posts };
};

const defaultElements = {
  form: document.querySelector('.rss-form'),
  submitButton: document.querySelector('[type="submit"]'),
  fields: {
    rssUrl: document.getElementById('url-input'),
  },
};

const defaultState = {
  feeds: [],
  posts: [],
  form: {
    lng: '',
    processState: 'filling',
    // processError: null,
    processFeedback: {
      key: '',
      type: '',
    },
    valid: true,
    // errors: {},
    fields: {
      rssUrl: '',
    },
    fieldsUi: {
      touched: {
        rssUrl: false,
      },
    },
  },
};

const app = (initialState, elements, i18n) => {
  const watchedState = watch(initialState, elements, i18n);
  watchedState.lng = i18n.lng;

  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { value } = elements.fields.rssUrl;
    watchedState.form.fields.rssUrl = value;
    watchedState.form.fieldsUi.touched.rssUrl = true;
    validate(watchedState)
      .then(() => {
        watchedState.form.errors = {};
        watchedState.form.valid = true;
        watchedState.form.processState = 'adding';
      })
      .then(() => {
        const findFeed = initialState.feeds
          .find((feed) => feed.url === watchedState.form.fields.rssUrl);
        if (findFeed) {
          throw new Error('Already exists!');
        }
      })
      .then(() => {
        const url = proxifyUrl(initialState.form.fields.rssUrl);
        return axios.get(url)
          .then((response) => response.data.contents);
      })
      .then((contents) => {
        const { feed, posts } = pars(contents);
        feed.url = initialState.form.fields.rssUrl;
        watchedState.feeds.push(feed);
        watchedState.posts.push(...posts);
        watchedState.form.processFeedback = { key: 'feedback.success.feedAdded', type: 'success' };
        watchedState.form.processState = 'success';
      })
      .catch((error) => {
        if (error.name === 'ValidationError') {
          // watchedState.form.errors = keyBy(error.inner, 'path');
          watchedState.form.processFeedback = error.message;
          watchedState.form.valid = false;
          console.dir(error);
          throw error;
        }
        if (error.message === 'Already exists!') {
          watchedState.form.processFeedback = { key: 'feedback.error.alreadyExists', type: 'error' };
          watchedState.form.processState = 'errors';
          throw error;
        }
        if (error.message === 'Network Error') {
          watchedState.form.processFeedback = { key: 'feedback.error.netError', type: 'error' };
          watchedState.form.processState = 'errors';
          throw error;
        }
        if (error.message === 'Parse error!') {
          watchedState.form.processFeedback = { key: 'feedback.error.parsingError', tyep: 'error' };
          watchedState.form.processState = 'errors';
          throw error;
        }
      });
  });
};

const initApp = (state, elements) => {
  const i18nInstance = i18next.createInstance();
  i18nInstance
    .init({
      lng: 'ru',
      resources,
    })
    .then(() => app(state, elements, i18nInstance));
};

initApp(defaultState, defaultElements);
