<template>
  <div>
    <div v-if="loading">
      <b-card no-body border-variant="primary" header-bg-variant="primary"
              header-text-variant="white" class="mx-auto contact-card" header="Loading...">
        <Loading />
      </b-card>
    </div>
    <div v-else>
      <b-card header="Contact" class="mx-auto contact-card" border-variant="primary">
        <b-list-group flush>
          <b-list-group-item v-for="contact in contacts" :key="contact.text" class="p-0">
            <b-button :href="contact.data.link[0].text" target="_blank" block variant="outline-primary" class="d-flex align-items-center justify-content-center py-3">
              <font-awesome-icon :icon="[contact.data.icon_style, contact.data.icon_name[0].text]" class="mr-2"/>
              {{ contact.data.text[0].text }}
            </b-button>
          </b-list-group-item>
        </b-list-group>
      </b-card>
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
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});

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

<style scoped>
.contact-card { max-width: 720px; width: 100%; }
</style>
