<template>
<div>
    <div v-if="loading">
        <b-card
        no-body
        style="width: 85%"
        border-variant="primary"
        header-bg-variant="primary"
        header-text-variant="white" 
        class="mx-auto"
        header="Loading...">
            <Loading />
        </b-card>
    </div>
    <div v-else>
        <ul>
            <b-card
                header="Contact"
                class="mx-auto"
                style="width: 85%"
            >
                <li v-for="contact in contacts" v-bind:key="contact.text">
                <button type="button" class="btn btn-primary btn-block" 
                    v-bind:onclick="'window.open(\'' + contact.data.link[0].text + '\', \'_blank\');'">
                    <font-awesome-icon v-bind:icon="[contact.data.icon_style, contact.data.icon_name[0].text]"/> 
                    {{contact.data.text[0].text}}
                </button>
            </li>
            </b-card>
        </ul>
    </div>
</div>    
</template>

<script>
import Loading from "~/components/Loading.vue";
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";

export default {
    components: {
        Loading
    },
    data() {
        return{
            loading: true,
            contacts: []
        };
    },

    methods: {
        async getContacts() {
            const api = await Prismic.getApi("https://msyed.cdn.prismic.io/api/v2", {accessToken: process.env.PRISMIC_TOKEN});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "contact"),
                { orderings : '[my.contact.priority]'}
            )
            this.contacts = response.results;
            this.loading = false;
        }
    },

    created () {
        this.getContacts()
    }
};
</script>

<style>
/* .container {
  margin: auto;
  display: flex;
  min-height: 100vh;
  text-align: center;
}

.title {
  font-family: monaco, monospace;
  display: flow-root;
  font-weight: 300;
  font-size: 6vw;
  color: #35495e;
  word-spacing: -1.5vw;
  letter-spacing: 1px;
  text-align: center;
}

.subtitle {
  font-family: monaco, monospace;
  display: flow-root;
  font-weight: 300;
  font-size: 3vw;
  color: #526488;
  word-spacing: -0.5vw;
  padding-bottom: 15px;
  text-align: center;
}

.links {
  padding-top: 15px;
  font-family: monaco, monospace;
} */
</style>