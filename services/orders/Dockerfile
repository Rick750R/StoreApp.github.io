FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev && rm -rf /var/lib/apt/lists/*
RUN docker-php-ext-install pdo_mysql mbstring && a2enmod rewrite && printf '<Directory /var/www/html>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/storeapp.conf && a2enconf storeapp
COPY services/common/ /var/www/common/
COPY services/orders/ /var/www/html/
RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
